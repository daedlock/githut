import type { AnyRouter } from "@tanstack/react-router";
import { trackPageview } from "@/app/lib/analytics";
import {
  isSettingsHref,
  openSettings,
  syncSettingsFromHistory,
  useSettingsModal,
} from "@/app/stores/settingsModal";
import { findTab, focusedTab, islands } from "@/app/workspace/model";
import { dispatch, getFocusedTab, getWorkspace, useWorkspaceStore } from "@/app/workspace/store";

// ─── Per-tab routers ─────────────────────────────────────────────────────────
//
// Each tab gets its own TanStack router over an in-memory history, created
// lazily on first show. The browser URL mirrors the focused tab (ADR 0002):
// in-tab navigation pushes/replaces browser entries, and browser back/forward
// is replayed onto the focused tab's own history, so Back never leaks across
// tabs. Routers are keyed by tab id, so a tab moved to another island keeps
// its router and history.
//
// The factory is injected from main.tsx (which owns routeTree + queryClient)
// to keep this module out of the route import graph.

type RouterFactory = (href: string, history?: AnyRouter["history"]) => AnyRouter;
type HistoryEvent = { location: { href: string }; action: { type: string } };

let factory: RouterFactory | null = null;
const routers = new Map<string, AnyRouter>();
const histories = new Map<string, AnyRouter["history"]>();
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
  const router = factory(href, histories.get(id));
  routers.set(id, router);
  histories.set(id, router.history);
  unsubscribers.set(
    id,
    router.history.subscribe(({ location, action }: HistoryEvent) =>
      onTabLocation(id, location.href, action.type),
    ),
  );
  return router;
}

export function getFocusedTabRouter(): AnyRouter | undefined {
  return routers.get(getFocusedTab().id);
}

/** Release page/router state while keeping an open tab's small history for its rebuild. */
export function releaseTabRouter(id: string) {
  unsubscribers.get(id)?.();
  unsubscribers.delete(id);
  routers.delete(id);
}

/** Forget a closed tab entirely; if undo brings it back, it rebuilds from its href. */
export function disposeTabRouter(id: string) {
  releaseTabRouter(id);
  histories.delete(id);
}

function currentUrl() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function writeUrl(href: string, mode: "push" | "replace") {
  trackPageview(href);
  if (currentUrl() === href) return;
  if (mode === "push") {
    seq += 1;
    window.history.pushState({ ghSeq: seq }, "", href);
  } else {
    window.history.replaceState({ ghSeq: seq }, "", href);
  }
}

function onTabLocation(id: string, href: string, action: string) {
  const before = findTab(getWorkspace().layout, id)?.tab.href;
  if (isSettingsHref(href)) {
    routers.get(id)?.history.replace(before ?? "/");
    openSettings();
    return;
  }
  dispatch({ type: "navigate", tabId: id, href });
  if (getFocusedTab().id !== id) return;

  if (!useSettingsModal.getState().open) writeUrl(href, action === "PUSH" ? "push" : "replace");

  // New page → start at the top, like a browser. Same-page search changes
  // (filters, sort) keep their place.
  if (action === "PUSH" && before?.split(/[?#]/)[0] !== href.split(/[?#]/)[0]) {
    document.querySelector(`[data-tab-pane="${id}"]`)?.scrollTo(0, 0);
  }
}

/**
 * Wire the browser URL to the workspace. Call once at startup, after the
 * workspace has been reconciled with the URL the app was opened at.
 */
export function startBrowserSync(): () => void {
  seq = typeof window.history.state?.ghSeq === "number" ? window.history.state.ghSeq : 0;
  window.history.replaceState({ ...window.history.state, ghSeq: seq }, "", currentUrl());
  // The tracker script loads deferred; report the first page once it's there.
  const firstPageview = () => trackPageview(currentUrl());
  if (document.readyState === "complete") setTimeout(firstPageview, 0);
  else window.addEventListener("load", firstPageview, { once: true });

  const onPopState = (e: PopStateEvent) => {
    const next = e.state?.ghSeq;
    if (syncSettingsFromHistory()) {
      if (typeof next === "number") seq = next;
      return;
    }
    if (typeof next !== "number") return;
    const router = getFocusedTabRouter();
    const delta = next - seq;
    seq = next;
    if (!router || delta === 0) return;
    const before = router.history.location.href;
    // The browser's long-press menu can traverse several entries at once;
    // memory history clamps the jump to the tab's own entries.
    router.history.go(delta);
    // The tab had no further history in that direction — keep showing it.
    if (router.history.location.href === before) writeUrl(before, "replace");
  };
  window.addEventListener("popstate", onPopState);

  // Moving focus re-points the URL without adding history entries, and
  // closed tabs' routers and histories are disposed.
  const unsubscribe = useWorkspaceStore.subscribe(({ workspace: ws }, { workspace: prev }) => {
    const focused = focusedTab(ws);
    if (focused.id !== focusedTab(prev).id && !useSettingsModal.getState().open)
      writeUrl(focused.href, "replace");
    if (ws.layout !== prev.layout) {
      const open = new Set(islands(ws.layout).flatMap((i) => i.tabs.map((t) => t.id)));
      for (const id of histories.keys()) {
        if (!open.has(id)) disposeTabRouter(id);
      }
    }
  });

  return () => {
    window.removeEventListener("popstate", onPopState);
    unsubscribe();
  };
}
