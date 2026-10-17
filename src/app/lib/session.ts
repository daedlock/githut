import { AUTH_CHANNEL, type AuthChannelMessage } from "@/app/lib/auth";
import { adoptToken } from "@/app/lib/github/client";
import { queryClient } from "@/app/lib/query";
import { useAuthStore } from "@/app/stores/auth";

// ─── Resuming a session ────────────────────────────────────────────────────
//
// When the sign-in popup hands back a token, the workspace adopts it in place:
// the expired flag clears, the onlineManager comes back online, and TanStack
// resumes paused queries and refetches stale ones. Nothing remounts, so
// layout, tabs, scroll and drafts are exactly as they were.
//
// A different GitHub account must not see the previous one's cached pages, so
// in that case the window reloads into a clean cache (tabs restore from
// storage).

async function fetchLogin(token: string): Promise<string | undefined> {
  try {
    const res = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
      cache: "no-store",
    });
    if (!res.ok) return undefined;
    const body = (await res.json()) as { login?: string };
    return body.login;
  } catch {
    return undefined;
  }
}

export async function resumeSession(token: string): Promise<void> {
  const current = useAuthStore.getState();
  // Signed-out windows (the login page) sign in through their own redirect.
  if (!current.token) return;
  if (token === current.token && !current.expired) return;
  const previous = queryClient.getQueryData<{ login?: string }>(["me"])?.login;
  const login = previous ? await fetchLogin(token) : undefined;
  const sameUser = !previous || login === previous;
  adoptToken(token, { sameUser });
  if (!sameUser) window.location.reload();
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
