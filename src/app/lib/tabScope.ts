import { createContext, useContext } from "react";

// ─── Tab scope ───────────────────────────────────────────────────────────────
//
// Every island shows its selected tab, so several pages are mounted and live
// at once. Keyboard input belongs to the focused tab only (GLOSSARY →
// Focused island): page shortcuts and window key listeners check
// `isFocused()` before acting, and list navigation stays inside the page's
// own pane. Outside any tab (overlays, the title bar) everything is in scope.

export type TabScope = {
  /** The tab this subtree renders in; null outside tabs. */
  tabId: string | null;
  /** Whether this tab is the focused tab right now. */
  isFocused: () => boolean;
};

const GLOBAL: TabScope = { tabId: null, isFocused: () => true };

export const TabScopeContext = createContext<TabScope>(GLOBAL);

export function useTabScope(): TabScope {
  return useContext(TabScopeContext);
}

/** The scroll pane of a tab, or the document outside tabs. */
export function tabPaneRoot(scope: TabScope): Element | Document {
  return (scope.tabId && document.querySelector(`[data-tab-pane="${scope.tabId}"]`)) || document;
}

/**
 * The tab pane an element scrolls inside (ADR 0001: each tab scrolls in its
 * own container, not the window). Use it as the `root` of IntersectionObservers
 * so margins and clipping are measured against the tab, not the viewport.
 * Null outside a tab, which observers treat as the viewport.
 */
export function tabScrollContainer(el: Element | null): HTMLElement | null {
  return el?.closest<HTMLElement>("[data-tab-pane]") ?? null;
}
