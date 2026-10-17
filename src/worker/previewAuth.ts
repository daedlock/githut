// ─── Preview sign-in ──────────────────────────────────────────────────────
//
// Cloudflare Workers Builds serves every branch and PR as a preview version
// at `<alias>-<worker>.<account-subdomain>.workers.dev`. GitHub only redirects
// OAuth logins back to the registered callback host (githut.app), so a
// preview signs in through production: production runs the OAuth flow and
// hands the token back to the preview origin carried in the signed state.
//
// Only hosts under this account's own workers.dev subdomain may receive a
// token. Nobody else can create aliases there, so another account can't
// register a lookalike preview and catch the token.

const ALIAS = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * The origin of `raw` if it is one of our preview hosts
 * (`https://<alias>-<suffix>`), otherwise null.
 */
export function previewOrigin(raw: string | undefined, suffix: string | undefined): string | null {
  if (!raw || !suffix) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.port || url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  const tail = `-${suffix.toLowerCase()}`;
  if (!host.endsWith(tail)) return null;
  if (!ALIAS.test(host.slice(0, -tail.length))) return null;
  return url.origin;
}
