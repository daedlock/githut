import { forgetRecentItems } from "@/app/lib/recentItems";
import { useAuthStore } from "@/app/stores/auth";

const OAUTH_TOKEN_KEY = "githut.oauth_token";
/** Stored only in the sign-in popup's sessionStorage, never shared across windows. */
const REAUTH_PENDING_KEY = "githut.reauth_pending";
const REAUTH_TTL_MS = 15 * 60 * 1000;
/** Same-origin channel the sign-in popup hands its token over on. */
export const AUTH_CHANNEL = "githut.auth";

export type AuthChannelMessage = { type: "token"; token: string };

/**
 * How this page load started:
 * - `none`: an ordinary load.
 * - `redirect`: back from the OAuth round-trip in this window (`/#t=<token>`).
 * - `handoff`: this window is the sign-in popup; its token went to the
 *   workspace window and the popup has nothing else to show.
 */
export type AuthBootstrap = "none" | "redirect" | "handoff";

/** The token the OAuth callback handed this page, if any (`/#t=<token>`). */
function takeRedirectToken(): string | null {
  // index.html strips the fragment before analytics runs and stashes it here.
  const stored = sessionStorage.getItem(OAUTH_TOKEN_KEY);
  if (stored) {
    sessionStorage.removeItem(OAUTH_TOKEN_KEY);
    return stored;
  }
  const hash = window.location.hash;
  if (!hash.startsWith("#t=") || hash.length === 3) return null;
  history.replaceState(null, "", window.location.pathname + window.location.search);
  return hash.slice(3);
}

export function bootstrapAuthFromHash(): AuthBootstrap {
  const token = takeRedirectToken();
  if (!token) return "none";

  // The OAuth callback lands on `<origin>/#t=…` whichever window started it.
  // A pending marker means a workspace window opened us as a popup.
  if (takeReauthPending()) {
    useAuthStore.getState().setToken(token);
    try {
      const channel = new BroadcastChannel(AUTH_CHANNEL);
      channel.postMessage({ type: "token", token } satisfies AuthChannelMessage);
      channel.close();
    } catch {
      // No BroadcastChannel: the token is persisted; the workspace picks it
      // up on its next load.
    }
    return "handoff";
  }

  useAuthStore.getState().setToken(token);
  return "redirect";
}

function takeReauthPending(): boolean {
  try {
    const at = Number(sessionStorage.getItem(REAUTH_PENDING_KEY));
    sessionStorage.removeItem(REAUTH_PENDING_KEY);
    return at > 0 && Date.now() - at < REAUTH_TTL_MS;
  } catch {
    return false;
  }
}

export function startLogin() {
  window.location.href = "/api/auth/login";
}

/**
 * Sign in again after the token expired, without leaving the workspace: the
 * OAuth flow runs in a popup and hands the token back (see `lib/session.ts`),
 * so tabs, scroll positions and unsent drafts survive. Falls back to a full
 * redirect when popups are blocked; layout, tabs and drafts still restore
 * from storage, but cached pages reload.
 */
export function startReauth() {
  if (typeof BroadcastChannel === "undefined") {
    startLogin();
    return;
  }
  const popup = window.open("about:blank", "githut-sign-in", "popup,width=520,height=720");
  try {
    if (popup) {
      popup.sessionStorage.setItem(REAUTH_PENDING_KEY, String(Date.now()));
      popup.location.href = "/api/auth/login";
      return;
    }
  } catch {
    popup?.close();
  }
  startLogin();
}

export function logout() {
  const { accountId } = useAuthStore.getState();
  useAuthStore.getState().clear();
  // Recent holds private page titles; don't leave them for the next account.
  // Navigate regardless if IndexedDB is slow or unavailable.
  const forget = forgetRecentItems(accountId).catch(() => {});
  const timeout = new Promise((resolve) => setTimeout(resolve, 500));
  void Promise.race([forget, timeout]).then(() => {
    window.location.href = "/login";
  });
}

// Opens GitHub's app management page where the user can grant/revoke per-org access.
// The existing token reflects org changes immediately — no new OAuth round-trip needed.
export function manageGitHubAccess() {
  window.open("/api/auth/manage", "_blank", "noopener,noreferrer");
}
