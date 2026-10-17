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
