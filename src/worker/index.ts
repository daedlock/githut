import { Hono } from "hono";
import type { Env } from "./env";

const OAUTH_SCOPES = "repo read:user read:org";
const STATE_TTL_MS = 10 * 60 * 1000;

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ ok: true, time: Date.now() }));

app.get("/api/auth/login", async (c) => {
  const state = await signState(c.env.OAUTH_STATE_SECRET);
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", c.env.GITHUB_CLIENT_ID);
  url.searchParams.set("scope", OAUTH_SCOPES);
  url.searchParams.set("state", state);
  url.searchParams.set("redirect_uri", `${c.env.APP_URL}/api/auth/callback`);
  return c.redirect(url.toString(), 302);
});

app.get("/api/auth/callback", async (c) => {
  const state = c.req.query("state");
  const code = c.req.query("code");
  const error = c.req.query("error");

  if (error) return c.redirect(`${c.env.APP_URL}/login?error=${encodeURIComponent(error)}`, 302);
  if (!state || !code) return c.redirect(`${c.env.APP_URL}/login?error=missing_params`, 302);

  const stateValid = await verifyState(state, c.env.OAUTH_STATE_SECRET);
  if (!stateValid) return c.redirect(`${c.env.APP_URL}/login?error=bad_state`, 302);

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: c.env.GITHUB_CLIENT_ID,
      client_secret: c.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  if (!tokenRes.ok) {
    return c.redirect(`${c.env.APP_URL}/login?error=token_exchange_failed`, 302);
  }

  const payload = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (payload.error || !payload.access_token) {
    return c.redirect(
      `${c.env.APP_URL}/login?error=${encodeURIComponent(payload.error ?? "no_token")}`,
      302,
    );
  }

  return c.redirect(`${c.env.APP_URL}/#t=${payload.access_token}`, 302);
});

// Redirect to GitHub's app management page so the user can grant/revoke per-org access.
// The existing token immediately reflects any org grants made there — no new token needed.
app.get("/api/auth/manage", (c) => {
  return c.redirect(
    `https://github.com/settings/connections/applications/${c.env.GITHUB_CLIENT_ID}`,
    302,
  );
});

// ─── Image upload (R2) ────────────────────────────────────────────────────
//
// Accepts a binary upload from the browser, stores it in R2, and returns a
// public URL. The caller must be authenticated (Bearer token checked against
// GitHub to confirm identity). Max 10MB, images only.

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"]);

app.post("/api/upload", async (c) => {
  const auth = c.req.header("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) {
    return c.json({ error: "missing_auth" }, 401);
  }

  const contentType = c.req.header("Content-Type") ?? "";
  if (!ALLOWED_TYPES.has(contentType)) {
    return c.json({ error: "unsupported_type", allowed: [...ALLOWED_TYPES] }, 400);
  }

  const body = await c.req.arrayBuffer();
  if (body.byteLength > MAX_UPLOAD_BYTES) {
    return c.json({ error: "too_large", max: MAX_UPLOAD_BYTES }, 413);
  }

  const ext = contentType.split("/")[1]?.replace("svg+xml", "svg") ?? "bin";
  const key = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

  if (!c.env.UPLOADS) {
    return c.json({ error: "uploads_not_configured" }, 503);
  }

  await c.env.UPLOADS.put(key, body, {
    httpMetadata: { contentType },
  });

  const url = `${c.env.APP_URL}/api/uploads/${key}`;
  return c.json({ url }, 201);
});

app.get("/api/uploads/:key", async (c) => {
  const key = c.req.param("key");
  const obj = await c.env.UPLOADS.get(key);
  if (!obj) return c.json({ error: "not_found" }, 404);

  const headers = new Headers();
  headers.set("Content-Type", obj.httpMetadata?.contentType ?? "application/octet-stream");
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return new Response(obj.body, { headers });
});

// ─── GitHub image/video proxy ─────────────────────────────────────────────
//
// GitHub's user-attachments URLs return 404 without a session cookie.
// Media elements can't send Authorization headers, so the token comes via
// query param. Keep the existing endpoint for images and video attachments.

app.get("/api/github-image", async (c) => {
  const reqUrl = new URL(c.req.url);
  const token = reqUrl.searchParams.get("token");
  const url = reqUrl.searchParams.get("url");
  if (!token || !url) return c.json({ error: "missing_params", debug: { hasToken: !!token, hasUrl: !!url } }, 400);

  const ALLOWED_HOSTS = ["github.com", "private-user-images.githubusercontent.com", "user-images.githubusercontent.com", "raw.githubusercontent.com"];
  let parsedHost: string;
  try { parsedHost = new URL(url).hostname; } catch { return c.json({ error: "invalid_url" }, 400); }
  if (!ALLOWED_HOSTS.some((h) => parsedHost === h || parsedHost.endsWith(`.${h}`))) {
    return c.json({ error: "disallowed_host", host: parsedHost }, 400);
  }

  // Badge SVGs don't support token auth. Detect the pattern and generate
  // a badge from the GitHub API instead.
  const badgeMatch = url.match(/github\.com\/([^/]+)\/([^/]+)\/actions\/workflows\/([^/]+)\/badge\.svg/);
  if (badgeMatch) {
    const [, bOwner, bRepo, bWorkflow] = badgeMatch;
    try {
      const apiRes = await fetch(
        `https://api.github.com/repos/${bOwner}/${bRepo}/actions/workflows/${bWorkflow}/runs?per_page=1&status=completed`,
        { headers: { Authorization: `token ${token}`, Accept: "application/vnd.github+json", "User-Agent": "githut/0.1" } },
      );
      let status = "unknown";
      let color = "#8b8a85";
      if (apiRes.ok) {
        const data = (await apiRes.json()) as { workflow_runs?: Array<{ conclusion: string | null }> };
        const conclusion = data.workflow_runs?.[0]?.conclusion ?? "unknown";
        if (conclusion === "success") { status = "passing"; color = "#22863a"; }
        else if (conclusion === "failure") { status = "failing"; color = "#cb2431"; }
        else if (conclusion === "cancelled") { status = "cancelled"; color = "#8b8a85"; }
        else { status = conclusion; color = "#dbab09"; }
      }
      const label = (bWorkflow as string).replace(/\.yml$|\.yaml$/i, "");
      const svg = renderBadgeSvg(label, status, color);
      return new Response(svg, {
        status: 200,
        headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=120" },
      });
    } catch {
      // Fall through to normal fetch on error
    }
  }

  // Step 1: hit GitHub with token auth to get the 302 → signed S3 URL.
  // Must NOT auto-follow — S3 rejects the Authorization header.
  const range = c.req.header("Range");
  const rangeHeaders: Record<string, string> = range ? { Range: range } : {};
  const gh = await fetch(url, {
    redirect: "manual",
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/octet-stream",
      "User-Agent": "githut/0.1",
      ...rangeHeaders,
    },
  });

  if ([301, 302, 303, 307, 308].includes(gh.status)) {
    const location = gh.headers.get("location");
    if (!location) return new Response(null, { status: 502 });

    // Step 2: fetch the signed S3 URL WITHOUT auth headers.
    const asset = await fetch(location, { headers: rangeHeaders });
    return githubAssetResponse(asset);
  }

  // Some assets return the body inline (small files, public repos).
  return githubAssetResponse(gh);
});

function githubAssetResponse(asset: Response): Response {
  const headers = new Headers({
    "Content-Type": asset.headers.get("Content-Type") ?? "application/octet-stream",
    "Cache-Control": "private, max-age=300",
  });
  // Preserve 206/416 and range metadata so native players can seek without
  // downloading the entire recording. Stream the body without buffering it.
  for (const name of ["Accept-Ranges", "Content-Range", "Content-Length"]) {
    const value = asset.headers.get(name);
    if (value && (asset.ok || name === "Content-Range")) headers.set(name, value);
  }
  return new Response(asset.ok ? asset.body : null, { status: asset.status, headers });
}

// ─── Actions log proxy ─────────────────────────────────────────────────────
//
// GitHub's job-logs endpoint returns a 302 to a short-lived Azure Blob URL
// that doesn't serve CORS — so the browser can't fetch logs directly.
// This route uses the caller's token server-side, follows the redirect,
// and streams the plain-text log bytes back with an Access-Control header.
// The token never lives in the Worker; we just forward it verbatim.

app.get("/api/actions/jobs/:jobId/logs", async (c) => {
  const auth = c.req.header("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) {
    return c.json({ error: "missing_auth" }, 401);
  }
  const token = auth.slice("Bearer ".length);

  const owner = c.req.query("owner");
  const repo = c.req.query("repo");
  const jobId = c.req.param("jobId");
  if (!owner || !repo || !jobId || !/^\d+$/.test(jobId)) {
    return c.json({ error: "bad_params" }, 400);
  }

  // Step 1: hit GitHub with the user's token. DO NOT auto-follow — GitHub
  // returns 302 → short-lived Azure Blob signed URL, and forwarding the
  // Authorization header to Azure causes 400 "invalid header". We handle
  // the redirect manually and drop auth for the blob fetch.
  const ghUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(
    repo,
  )}/actions/jobs/${jobId}/logs`;
  const gh = await fetch(ghUrl, {
    redirect: "manual",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "githut/0.1",
    },
  });

  // Step 2: follow the redirect ourselves to the signed URL, WITHOUT auth.
  if (gh.status === 302 || gh.status === 301) {
    const location = gh.headers.get("location");
    if (!location) return c.json({ error: "no_redirect_target" }, 502);

    let blob: Response;
    try {
      blob = await fetch(location);
    } catch (err) {
      return c.json(
        { error: "blob_fetch_threw", detail: err instanceof Error ? err.message : String(err) },
        502,
      );
    }

    if (!blob.ok) {
      // Pass Azure's status through verbatim. Squashing to 502 hides real
      // diagnostics: 404 = blob not yet written, 410 = archive expired,
      // 403 = signature problem, 5xx = transient Azure error. Each needs
      // a different UX path; the client decides.
      const detail = await blob.text().catch(() => "");
      return c.json(
        {
          error: "blob_error",
          status: blob.status,
          detail: detail.slice(0, 500),
        },
        // Hono's status type only accepts known HTTP codes — 4xx/5xx are
        // always safe here because `blob.ok` is false.
        blob.status as 400 | 401 | 403 | 404 | 410 | 500 | 502 | 503 | 504,
      );
    }

    return new Response(blob.body, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": c.env.APP_URL,
      },
    });
  }

  // Some edge cases return the body inline (small logs, specific endpoints).
  if (gh.ok) {
    return new Response(gh.body, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": c.env.APP_URL,
      },
    });
  }

  // GitHub error (non-redirect, non-2xx) — surface its status so the UI
  // can render a scoped message. 401/403/404 are the ones clients care
  // about; anything else becomes 502 since it's an upstream glitch.
  const bodyText = await gh.text().catch(() => "");
  return c.json(
    { error: "github_error", status: gh.status, detail: bodyText.slice(0, 200) },
    gh.status === 401 || gh.status === 403 || gh.status === 404 ? gh.status : 502,
  );
});

app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;

const encoder = new TextEncoder();

async function hmacKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function b64url(bytes: Uint8Array) {
  let bin = "";
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? 0 : 4 - (s.length % 4);
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function signState(secret: string): Promise<string> {
  const nonce = crypto.getRandomValues(new Uint8Array(16));
  const issued = Date.now();
  const payload = `${b64url(nonce)}.${issued}`;
  const key = await hmacKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
  return `${payload}.${b64url(sig)}`;
}

async function verifyState(token: string, secret: string): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [nonceB64, issuedStr, sigB64] = parts as [string, string, string];
  const issued = Number(issuedStr);
  if (!Number.isFinite(issued) || Date.now() - issued > STATE_TTL_MS) return false;
  const key = await hmacKey(secret);
  const sig = b64urlDecode(sigB64);
  const sigBuffer = new ArrayBuffer(sig.byteLength);
  new Uint8Array(sigBuffer).set(sig);
  return crypto.subtle.verify("HMAC", key, sigBuffer, encoder.encode(`${nonceB64}.${issuedStr}`));
}

function renderBadgeSvg(label: string, status: string, color: string): string {
  const labelW = label.length * 6.5 + 12;
  const statusW = status.length * 6.5 + 12;
  const totalW = labelW + statusW;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="20" role="img">
  <linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
  <clipPath id="r"><rect width="${totalW}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelW}" height="20" fill="#555"/>
    <rect x="${labelW}" width="${statusW}" height="20" fill="${color}"/>
    <rect width="${totalW}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">
    <text x="${labelW / 2}" y="14">${escapeXml(label)}</text>
    <text x="${labelW + statusW / 2}" y="14">${escapeXml(status)}</text>
  </g>
</svg>`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
