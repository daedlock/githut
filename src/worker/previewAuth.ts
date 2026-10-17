// ─── Preview sign-in ──────────────────────────────────────────────────────
//
// Cloudflare Workers Builds serves every branch and PR as a Worker Preview at
// `<preview-name>.githut.app` (and each deployment at
// `<deployment-id>-<preview-name>.githut.app`). GitHub only redirects OAuth
// logins back to the registered callback host, so a preview signs in through
// production: production runs the OAuth flow and hands the token back to the
// preview origin carried in the signed state.
//
// Only single-label subdomains of our own zone may receive a token; nobody
// else can create hosts there.

const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * The origin of `raw` if it is one of our preview hosts
 * (`https://<label>.<zone>`), otherwise null. The zone apex itself is
 * production, not a preview.
 */
export function previewOrigin(raw: string | undefined, zone: string | undefined): string | null {
  if (!raw || !zone) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.port || url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  const tail = `.${zone.toLowerCase()}`;
  if (!host.endsWith(tail)) return null;
  if (!LABEL.test(host.slice(0, -tail.length))) return null;
  return url.origin;
}
