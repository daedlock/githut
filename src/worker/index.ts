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
