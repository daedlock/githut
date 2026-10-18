import { AUTH_CHANNEL, type AuthChannelMessage } from "@/app/lib/auth";
import { adoptToken } from "@/app/lib/github/client";
import { queryClient } from "@/app/lib/query";
import { useAuthStore } from "@/app/stores/auth";

// ─── Resuming a session ────────────────────────────────────────────────────
//
// When the sign-in popup hands back a token, the workspace adopts it in place:
// the expired flag clears, the onlineManager comes back online, and TanStack
// resumes paused queries, and visible data refetches. Nothing remounts, so
// layout, tabs, scroll and drafts are exactly as they were.
//
// A different GitHub account must not see the previous one's cached pages, so
// in that case the window reloads into a clean cache (tabs restore from
// storage).

async function fetchAccount(token: string): Promise<{ login: string; id: number } | undefined> {
  try {
    const res = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
      cache: "no-store",
    });
    if (!res.ok) return undefined;
    const body = (await res.json()) as { login?: string; id?: number };
    return typeof body.login === "string" &&
      typeof body.id === "number" &&
      Number.isSafeInteger(body.id) &&
      body.id > 0
      ? { login: body.login, id: body.id }
      : undefined;
  } catch {
    return undefined;
  }
}

export async function resumeSession(token: string): Promise<void> {
  const current = useAuthStore.getState();
  // Signed-out windows (the login page) sign in through their own redirect.
  if (!current.token) return;
  if (token === current.token && !current.expired) return;
  const account = await fetchAccount(token);
  if (!account || useAuthStore.getState().token !== current.token) return;
  const sameUser = account.id === current.accountId;
  if (!sameUser) queryClient.clear();
  adoptToken(token, { sameUser, accountId: account.id });
  if (!sameUser) {
    window.location.reload();
    return;
  }
  // Refresh what's on screen: anything may have changed while signed out, and
  // queries that opted out of retries errored on the 401 instead of pausing.
  // Conditional requests keep this cheap.
  void queryClient.invalidateQueries();
}

/** Listen for tokens handed over by a sign-in popup. Call once at startup. */
export function listenForSignIn(): () => void {
  if (typeof BroadcastChannel === "undefined") return () => {};
  const channel = new BroadcastChannel(AUTH_CHANNEL);
  channel.onmessage = (e: MessageEvent<AuthChannelMessage>) => {
    if (e.data?.type === "token" && e.data.token) void resumeSession(e.data.token);
  };
  return () => channel.close();
}
