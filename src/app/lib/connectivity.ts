import { onlineManager } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { useAuthStore } from "@/app/stores/auth";

// ─── Connectivity ──────────────────────────────────────────────────────────
//
// TanStack Query pauses queries while `onlineManager` says offline and resumes
// them (refetching stale data) when it flips back. We feed it "can we reach
// GitHub": the browser is online AND the session hasn't expired. So both an
// offline window and an expired token keep cached pages readable instead of
// turning them into error states, and both recover the same way.

function browserOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

function subscribeBrowserOnline(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

onlineManager.setEventListener((setOnline) => {
  const update = () => setOnline(browserOnline() && !useAuthStore.getState().expired);
  update();
  const unsubscribeBrowser = subscribeBrowserOnline(update);
  const unsubscribeAuth = useAuthStore.subscribe((s, prev) => {
    if (s.expired !== prev.expired) update();
  });
  return () => {
    unsubscribeBrowser();
    unsubscribeAuth();
  };
});

/** Whether the browser has a network connection. */
export function useBrowserOnline(): boolean {
  return useSyncExternalStore(subscribeBrowserOnline, browserOnline, () => true);
}

/**
 * Whether actions that change things on GitHub (comment, merge, close…) can
 * run right now. `reason` says why not, for a tooltip.
 */
export function useCanMutate(): { canMutate: boolean; reason: string | undefined } {
  const online = useBrowserOnline();
  const expired = useAuthStore((s) => s.expired);
  const token = useAuthStore((s) => s.token);
  const reason = unavailableReason(online, expired || !token);
  return { canMutate: !reason, reason };
}

function unavailableReason(online: boolean, signedOut: boolean): string | undefined {
  if (!online) return "You're offline. Reconnect to make changes.";
  if (signedOut) return "Sign in again to make changes.";
}

/** Reject before optimistic work starts; no write is queued for reconnect. */
export function assertCanMutate(): void {
  const { token, expired } = useAuthStore.getState();
  const reason = unavailableReason(browserOnline(), expired || !token);
  if (reason) throw new Error(reason);
}
