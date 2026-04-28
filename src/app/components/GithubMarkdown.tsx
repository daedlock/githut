import { Link } from "@tanstack/react-router";
import { Fragment } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import type { PluggableList } from "unified";

import { useCodeTokens } from "@/app/components/code";
import { FS_BOLD, FS_ITALIC, FS_STRIKETHROUGH, FS_UNDERLINE } from "@/app/components/code/types";
import { detectEntity, EntityHoverLink } from "@/app/components/ui/EntityHoverCard";
import { LightboxImage } from "@/app/components/ui/ImageLightbox";
import { Skeleton } from "@/app/components/ui/skeleton";
import { toInternalHref } from "@/app/lib/githubUrl";
import { type RepoContext, remarkMentions } from "@/app/lib/remarkMentions";
import { useAuthStore } from "@/app/stores/auth";

// Extended sanitize schema — GitHub-compatible HTML subset.
// Adds: details/summary, kbd, sup, sub, mark, del, ins, align/width/height attrs.
const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "details",
    "summary",
    "kbd",
    "sup",
    "sub",
    "mark",
    "del",
    "ins",
    "abbr",
    "cite",
    "dfn",
    "samp",
    "var",
  ],
  attributes: {
    ...defaultSchema.attributes,
    td: [...(defaultSchema.attributes?.td ?? []), "align"],
    th: [...(defaultSchema.attributes?.th ?? []), "align"],
    code: [...(defaultSchema.attributes?.code ?? []), "className"],
    img: [...(defaultSchema.attributes?.img ?? []), "width", "height", "align"],
    div: [...(defaultSchema.attributes?.div ?? []), "align"],
    p: [...(defaultSchema.attributes?.p ?? []), "align"],
    "*": [...(defaultSchema.attributes?.["*"] ?? []), "id"],
  },
};

const REHYPE_PLUGINS: PluggableList = [rehypeRaw, [rehypeSanitize, sanitizeSchema]];

/**
 * Repo context for resolving relative asset URLs in markdown. When a README
 * contains `![logo](./assets/logo.png)` we need to rewrite the img src to
 * `https://raw.githubusercontent.com/{owner}/{repo}/{ref}/{basePath}/assets/logo.png`
 * — otherwise the browser tries to load it from our app's origin and 404s.
 *
 * - `basePath` is the DIRECTORY of the markdown file (e.g. "docs" for
 *   `docs/intro.md`). Leave empty for a root-level README.
 * - `ref` can be a branch name, tag, or commit SHA. Falls back to "HEAD".
 * - Omit this prop entirely for non-repo contexts (issue/comment bodies)
 *   where URLs are already absolute.
 */
export type MarkdownAssetContext = {
  owner: string;
  repo: string;
  ref?: string;
  basePath?: string;
};

/**
 * Rewrite a markdown asset URL to its raw.githubusercontent.com equivalent
 * when it's relative. Absolute URLs (http(s)://, data:, //), in-page anchors,
 * and mailto: links pass through unchanged.
 */
export function rewriteAssetUrl(src: string, ctx: MarkdownAssetContext): string {
  if (!src) return src;
  // Already absolute (any scheme), protocol-relative, or an in-page anchor —
  // leave alone. Covers http(s)://, data:, mailto:, tel:, //cdn/..., #section.
  if (/^[a-z][a-z0-9+\-.]*:/i.test(src) || src.startsWith("//") || src.startsWith("#")) {
    return src;
  }
  const branch = ctx.ref ?? "HEAD";
  const rawBase = `https://raw.githubusercontent.com/${ctx.owner}/${ctx.repo}/${branch}/`;
  // Leading-slash path = repo-root-relative ("/docs/logo.png" → repo root + docs/logo.png)
  if (src.startsWith("/")) {
    return rawBase + src.replace(/^\/+/, "");
  }
  // Truly relative — resolve against basePath (the directory of the current
  // markdown file). Using URL constructor handles `..` and `.` segments.
  const dir = ctx.basePath ? (ctx.basePath.endsWith("/") ? ctx.basePath : `${ctx.basePath}/`) : "";
  try {
    return new URL(src, rawBase + dir).toString();
  } catch {
    return src;
  }
}

function proxyGitHubImage(src: string): string {
  try {
    const u = new URL(src);
    const host = u.hostname;
    if (host !== "github.com" && !host.endsWith(".githubusercontent.com")) return src;
  } catch {
    return src;
  }
  const token = useAuthStore.getState().token;
  if (!token) return src;
  return `/api/github-image?url=${encodeURIComponent(src)}&token=${encodeURIComponent(token)}`;
}

function buildComponents(assetContext?: MarkdownAssetContext): Components {
  return {
    a: ({ href, children, ...rest }) => {
      const text = typeof children === "string" ? children : "";
      const entity = href ? detectEntity(href, text) : null;
      if (entity && href) {
        return (
          <EntityHoverLink entity={entity} href={href} {...rest}>
            {children}
          </EntityHoverLink>
        );
      }
      const internal = href ? toInternalHref(href) : null;
      if (internal) {
        return (
          <Link to={internal} {...rest}>
            {children}
          </Link>
        );
      }
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
          {children}
        </a>
      );
    },
    img: ({ src, alt, ...rest }) => {
      let resolved =
        assetContext && typeof src === "string" ? rewriteAssetUrl(src, assetContext) : src;
      if (typeof resolved === "string") resolved = proxyGitHubImage(resolved);
      return <LightboxImage src={resolved as string | undefined} alt={alt} {...rest} />;
    },
    pre: ({ children }) => <Fragment>{children}</Fragment>,
    code: ({ className, children, ...rest }) => {
      const raw = String(children ?? "");
      const match = /language-([^\s]+)/.exec(className ?? "");
      const lang = match?.[1] ?? "text";
      const isBlock = !!match || raw.includes("\n");

      if (isBlock) {
        return <MarkdownCodeBlock code={raw.replace(/\n$/, "")} lang={lang} />;
      }

      return (
        <code className={className} {...rest}>
          {children}
        </code>
      );
    },
  };
}

const MARKDOWN_COMPONENTS_NO_CONTEXT = buildComponents();

const CODE_SKELETON_WIDTHS = ["68%", "82%", "54%", "76%", "61%", "88%", "47%", "72%"] as const;

function MarkdownCodeBlock({ code, lang }: { code: string; lang: string }) {
  const { data: tokenLines, isPending } = useCodeTokens(code, lang);
  const lines = code.split("\n");

  return (
    <div className="my-4 overflow-hidden rounded-md bg-[var(--color-bg-sunken)]">
      {isPending || !tokenLines ? (
        <div className="skeleton-fade flex flex-col gap-1.5 p-3">
          {CODE_SKELETON_WIDTHS.slice(0, Math.min(lines.length, CODE_SKELETON_WIDTHS.length)).map(
            (width) => (
              <Skeleton key={width} className="h-3.5" style={{ width }} />
            ),
          )}
        </div>
      ) : (
        <pre className="markdown-code-pre m-0 overflow-x-auto bg-transparent p-3 font-mono text-code leading-[20px]">
          <code className="markdown-code-code bg-transparent p-0 text-code">
            {renderTokenLines(tokenLines, lines)}
          </code>
        </pre>
      )}
    </div>
  );
}

function renderTokenLines(
  tokenLines: Array<{ tokens: Array<{ content: string; color?: string; fontStyle?: number }> }>,
  lines: string[],
) {
  const out: React.ReactNode[] = [];
  let offset = 0;

  for (const line of tokenLines) {
    const lineText = lines[out.length] ?? "";
    out.push(
      <Fragment key={`${offset}-${lineText}`}>
        {renderTokens(line.tokens)}
        {out.length < tokenLines.length - 1 ? "\n" : null}
      </Fragment>,
    );
    offset += lineText.length + 1;
  }

  return out;
}

function renderTokens(tokens: Array<{ content: string; color?: string; fontStyle?: number }>) {
  let offset = 0;
  return tokens.map((token) => {
    const key = `${offset}-${token.content}`;
    offset += token.content.length;
    return (
      <span key={key} style={{ color: token.color, ...fontStyleToCSS(token.fontStyle) }}>
        {token.content}
      </span>
    );
  });
}

function fontStyleToCSS(fs: number | undefined): React.CSSProperties {
  if (!fs || fs <= 0) return {};
  return {
    fontStyle: fs & FS_ITALIC ? "italic" : undefined,
    fontWeight: fs & FS_BOLD ? "bold" : undefined,
    textDecoration:
      [fs & FS_UNDERLINE ? "underline" : "", fs & FS_STRIKETHROUGH ? "line-through" : ""]
        .filter(Boolean)
        .join(" ") || undefined,
  };
}

export function GithubMarkdown({
  children,
  assetContext,
  repoContext,
}: {
  children: string;
  assetContext?: MarkdownAssetContext;
  repoContext?: RepoContext;
}) {
  const components = assetContext ? buildComponents(assetContext) : MARKDOWN_COMPONENTS_NO_CONTEXT;
  const remarkPlugins = repoContext
    ? [remarkGfm, remarkMentions(repoContext)]
    : [remarkGfm, remarkMentions()];
  return (
    <ReactMarkdown
      remarkPlugins={remarkPlugins}
      rehypePlugins={REHYPE_PLUGINS}
      components={components}
    >
      {children}
    </ReactMarkdown>
  );
}
