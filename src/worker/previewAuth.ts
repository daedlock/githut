// ─── PR preview sign-in ───────────────────────────────────────────────────
//
// GitHub only redirects OAuth logins back to the registered callback host
// (githut.app). Previews live on workers.dev, so a preview's login hops
// through production: production runs the OAuth flow and hands the token
// back to the preview origin carried in the signed state.
//
// Only our own preview hosts may receive a token. The suffix is the exact
// `<worker>.<account-subdomain>.workers.dev` of this account, so another
// account can't register a lookalike preview and catch the token.

const PREVIEW_ALIAS = /^pr-\d{1,6}$/;

/**
 * The origin of `raw` if it is one of our PR preview hosts
 * (`https://pr-<n>-<suffix>`), otherwise null.
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
  if (!PREVIEW_ALIAS.test(host.slice(0, -tail.length))) return null;
  return url.origin;
}
