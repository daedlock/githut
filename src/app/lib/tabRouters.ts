import type { AnyRouter } from "@tanstack/react-router";
import { getTabsSnapshot, setTabHref, useTabsStore } from "@/app/stores/tabs";

// ─── Per-tab routers ─────────────────────────────────────────────────────────
//
// Each tab gets its own TanStack router over an in-memory history, created
// lazily on first activation. The browser URL mirrors whichever tab is active:
// in-tab navigation pushes/replaces browser entries, and browser back/forward
// is replayed onto the active tab's own history, so Back never leaks across
// tabs.
//
// The factory is injected from main.tsx (which owns routeTree + queryClient)
// to keep this module out of the route import graph.

type RouterFactory = (href: string) => AnyRouter;
type HistoryEvent = { location: { href: string }; action: { type: string } };

let factory: RouterFactory | null = null;
const routers = new Map<string, AnyRouter>();
const unsubscribers = new Map<string, () => void>();

/** Browser history entries we create carry a monotonically increasing index. */
let seq = 0;

export function setTabRouterFactory(fn: RouterFactory) {
  factory = fn;
}

export function getTabRouter(id: string, href: string): AnyRouter {
  const existing = routers.get(id);
  if (existing) return existing;
  if (!factory) throw new Error("Tab router factory not configured");
  const router = factory(href);
  routers.set(id, router);
  unsubscribers.set(
    id,
    router.history.subscribe(({ location, action }: HistoryEvent) =>
      onTabLocation(id, location.href, action.type),
    ),
  );
  return router;
}

export function getActiveTabRouter(): AnyRouter | undefined {
  const { activeId } = getTabsSnapshot();
  return activeId ? routers.get(activeId) : undefined;
}

/** Drop a tab's router; it's rebuilt from the tab's href if the tab is shown again. */
export function disposeTabRouter(id: string) {
  unsubscribers.get(id)?.();
  unsubscribers.delete(id);
  routers.delete(id);
}

function currentUrl() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function writeUrl(href: string, mode: "push" | "replace") {
  if (currentUrl() === href) return;
  if (mode === "push") {
    seq += 1;
    window.history.pushState({ ghSeq: seq }, "", href);
  } else {
    window.history.replaceState({ ghSeq: seq }, "", href);
  }
}

function onTabLocation(id: string, href: string, action: string) {
  const before = getTabsSnapshot().tabs.find((t) => t.id === id)?.href;
  useTabsStore.getState().apply((s) => setTabHref(s, id, href));
  if (getTabsSnapshot().activeId !== id) return;

  writeUrl(href, action === "PUSH" ? "push" : "replace");

  // New page → start at the top, like a browser. Same-page search changes
  // (filters, sort) keep their place.
  if (action === "PUSH" && before?.split(/[?#]/)[0] !== href.split(/[?#]/)[0]) {
    document.querySelector(`[data-tab-pane="${id}"]`)?.scrollTo(0, 0);
  }
}

/**
 * Wire the browser URL to the tab model. Call once at startup, after the
 * store has been reconciled with the URL the app was opened at.
 */
export function startBrowserSync(): () => void {
  seq = typeof window.history.state?.ghSeq === "number" ? window.history.state.ghSeq : 0;
  window.history.replaceState({ ...window.history.state, ghSeq: seq }, "", currentUrl());

  const onPopState = (e: PopStateEvent) => {
    const next = e.state?.ghSeq;
    if (typeof next !== "number") return;
    const router = getActiveTabRouter();
    const delta = next - seq;
    seq = next;
    if (!router || delta === 0) return;
    const before = router.history.location.href;
    if (delta < 0) router.history.back();
    else router.history.forward();
    // The tab had no further history in that direction — keep showing it.
    if (router.history.location.href === before) writeUrl(before, "replace");
  };
  window.addEventListener("popstate", onPopState);

  // Switching tabs re-points the URL without adding history entries, and
  // routers of closed tabs are released.
  const unsubscribe = useTabsStore.subscribe((s, prev) => {
    if (s.activeId !== prev.activeId) {
      const active = s.tabs.find((t) => t.id === s.activeId);
      if (active) writeUrl(active.href, "replace");
    }
    if (s.tabs !== prev.tabs) {
      for (const id of routers.keys()) {
        if (!s.tabs.some((t) => t.id === id)) disposeTabRouter(id);
      }
    }
  });

  return () => {
    window.removeEventListener("popstate", onPopState);
    unsubscribe();
  };
}
