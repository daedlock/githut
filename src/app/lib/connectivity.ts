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
  return typeof navigator === "undefined" ? true : navigator.onLine;
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
  if (!online) return { canMutate: false, reason: "You're offline. Reconnect to make changes." };
  if (expired) return { canMutate: false, reason: "Sign in again to make changes." };
  return { canMutate: true, reason: undefined };
}
