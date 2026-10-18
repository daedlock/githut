// ─── Link previews (Open Graph) ────────────────────────────────────────────
//
// GitHut is a SPA, so crawlers that unfurl links (Slack, Discord, X, iMessage…)
// only ever see the static tags in index.html. For those crawlers we fetch the
// equivalent github.com page anonymously, lift its OG/Twitter tags (including
// GitHub's rendered opengraph.githubassets.com card), and splice them into our
// shell. Anonymous fetch means private repos 404 and fall back to the default
// tags — nothing private can leak through a preview.

const GITHUB = "https://github.com";
const META_CACHE_TTL_S = 60 * 60;
const MAX_HEAD_BYTES = 256 * 1024;

const BOT_UA =
  /bot|crawler|spider|facebookexternalhit|meta-externalagent|slack|discord|twitter|telegram|whatsapp|linkedin|skype|embedly|pinterest|vkshare|redditbot|mastodon|bluesky|cardyb|iframely|outbrain|google-inspectiontool|preview/i;

// First path segments that are GitHut app routes, not GitHub users/orgs.
const APP_ROUTES = new Set(["login", "settings", "playground", "api", "assets", "fonts"]);

export type OgMeta = {
  title?: string;
  tags: Array<{ attr: "property" | "name"; key: string; content: string }>;
};

export function isLinkPreviewBot(userAgent: string | null | undefined): boolean {
  return !!userAgent && BOT_UA.test(userAgent);
}

/** Map a GitHut URL to the github.com page that shows the same thing. */
export function githubPathFor(url: URL): string | null {
  const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  const [owner, repo, section, id] = parts;
  if (!owner || APP_ROUTES.has(owner) || owner.includes(".")) return null;
  if (!repo) return `/${enc(owner)}`;

  const base = `/${enc(owner)}/${enc(repo)}`;
  switch (section) {
    case undefined:
      return base;
    case "pull":
    case "pr":
    case "review":
      return id ? `${base}/pull/${enc(id)}` : `${base}/pulls`;
    case "pulls":
      return `${base}/pulls`;
    case "issues":
      return id ? `${base}/issues/${enc(id)}` : `${base}/issues`;
    case "commit":
      return id ? `${base}/commit/${enc(id)}` : `${base}/commits`;
    case "commits":
      return `${base}/commits`;
    case "actions":
      return id === "runs" && parts[4]
        ? `${base}/actions/runs/${enc(parts[4])}`
        : `${base}/actions`;
    case "code": {
      const path = url.searchParams.get("path");
      if (!path) return base;
      const kind = url.searchParams.get("view") === "blob" ? "blob" : "tree";
      const branch = url.searchParams.get("branch") ?? "HEAD";
      const segments = path.split("/").filter(Boolean).map(enc).join("/");
      return `${base}/${kind}/${enc(branch)}/${segments}`;
    }
    default:
      return base;
  }
}

/** Fetch a github.com page anonymously and extract its preview tags. Cached. */
export async function fetchGitHubMeta(
  githubPath: string,
  ctx?: { waitUntil(p: Promise<unknown>): void },
): Promise<OgMeta | null> {
  const target = `${GITHUB}${githubPath}`;
  const cache =
    typeof caches !== "undefined" ? (caches as unknown as { default?: Cache }).default : undefined;
  const cacheKey = new Request(`https://og-cache.githut.app${githubPath}`);

  const hit = await cache?.match(cacheKey);
  if (hit) return (await hit.json()) as OgMeta | null;

  let meta: OgMeta | null = null;
  try {
    const res = await fetch(target, {
      headers: { "User-Agent": "githut-og/1.0 (+https://githut.app)", Accept: "text/html" },
    });
    if (res.ok && res.body) meta = await parseHeadMeta(await readHead(res.body));
  } catch {
    meta = null;
  }

  // Cache misses too, so a crawler storm on a private repo doesn't hammer GitHub.
  const put = cache?.put(
    cacheKey,
    new Response(JSON.stringify(meta), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${meta ? META_CACHE_TTL_S : 300}`,
      },
    }),
  );
  if (put) ctx ? ctx.waitUntil(put) : await put;
  return meta;
}

/** Replace the shell's default preview tags with `meta`, pointing og:url at GitHut. */
export function injectMeta(shell: Response, meta: OgMeta, appUrl: string): Response {
  const keys = new Set(meta.tags.map((t) => t.key));
  keys.add("og:url");
  const tags = [
    ...meta.tags.filter((t) => t.key !== "og:url" && t.key !== "og:site_name"),
    { attr: "property" as const, key: "og:url", content: appUrl },
    { attr: "property" as const, key: "og:site_name", content: "GitHut" },
  ];
  keys.add("og:site_name");

  const html = tags
    .map((t) => `<meta ${t.attr}="${escapeAttr(t.key)}" content="${escapeAttr(t.content)}" />`)
    .join("\n");

  const rewritten = new HTMLRewriter()
    .on("meta", {
      element(el) {
        const key = el.getAttribute("property") ?? el.getAttribute("name");
        if (key && (keys.has(key) || key === "description")) el.remove();
      },
    })
    .on("title", {
      element(el) {
        if (meta.title) el.setInnerContent(meta.title);
      },
    })
    .on("head", {
      element(el) {
        el.append(html, { html: true });
      },
    })
    .transform(shell);

  const headers = new Headers(rewritten.headers);
  headers.set("Cache-Control", "public, max-age=300");
  headers.delete("ETag");
  return new Response(rewritten.body, { status: rewritten.status, headers });
}

async function readHead(body: ReadableStream<Uint8Array>): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let html = "";
  while (html.length < MAX_HEAD_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    html += decoder.decode(value, { stream: true });
    const end = html.indexOf("</head>");
    if (end !== -1) {
      html = html.slice(0, end + 7);
      break;
    }
  }
  reader.cancel().catch(() => {});
  return html;
}

async function parseHeadMeta(head: string): Promise<OgMeta | null> {
  const meta: OgMeta = { tags: [] };
  let title = "";
  await new HTMLRewriter()
    .on("meta", {
      element(el) {
        const property = el.getAttribute("property");
        const name = el.getAttribute("name");
        const content = el.getAttribute("content");
        if (content == null) return;
        const value = decodeEntities(content);
        if (property?.startsWith("og:"))
          meta.tags.push({ attr: "property", key: property, content: value });
        else if (name?.startsWith("twitter:") || name === "description")
          meta.tags.push({ attr: "name", key: name, content: value });
      },
    })
    .on("title", {
      text(chunk) {
        title += chunk.text;
      },
    })
    .transform(new Response(head))
    .arrayBuffer();

  if (!meta.tags.some((t) => t.key === "og:title")) return null;
  meta.title = rebrand(decodeEntities(title.trim())) || undefined;
  // twitter:site is GitHub's handle; don't attribute our previews to them.
  meta.tags = meta.tags
    .filter((t) => t.key !== "twitter:site")
    .map((t) => (t.key.endsWith(":title") ? { ...t, content: rebrand(t.content) } : t));
  return meta;
}

// GitHub titles read "GitHub - owner/repo: …" / "… · GitHub"; the link is to GitHut.
function rebrand(title: string): string {
  return title.replace(/^GitHub - /, "GitHut - ").replace(/ · GitHub$/, " · GitHut");
}

function enc(segment: string): string {
  return encodeURIComponent(segment);
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// GitHub double-escapes some descriptions (`we&amp;#39;ve`), so decode to a fixed point.
function decodeEntities(s: string): string {
  for (let i = 0; i < 3; i++) {
    const next = decodeOnce(s);
    if (next === s) break;
    s = next;
  }
  return s;
}

function decodeOnce(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(Number.parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
