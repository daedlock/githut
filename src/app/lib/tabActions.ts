import { getFocusedTabRouter } from "@/app/lib/tabRouters";
import { useSettingsStore } from "@/app/stores/settings";
import { type Direction, focusedTab, type Side } from "@/app/workspace/model";
import { dispatch, getWorkspace } from "@/app/workspace/store";

// Imperative workspace commands shared by island headers, keyboard
// shortcuts, the shift+click interceptor, the link hover menu and the
// command palette. Every tab stays mounted (TabHost), so these are pure
// state changes — switching tabs is just a visibility flip.

export function tabsEnabled(): boolean {
  return useSettingsStore.getState().tabsEnabled;
}

/** Open `href` as a new tab in the focused island (navigates instead when tabs are off). */
export function openInNewTab(href: string, opts: { select?: boolean } = {}) {
  if (!tabsEnabled()) {
    void getFocusedTabRouter()?.navigate({ href });
    return;
  }
  dispatch({ type: "openTab", href, select: opts.select });
}

export function selectTab(tabId: string) {
  dispatch({ type: "selectTab", tabId });
}

/** Select the n-th tab of the focused island; -1 is the last. */
export function selectTabAt(index: number) {
  dispatch({ type: "selectTabAt", index });
}

export function cycleTab(delta: 1 | -1) {
  dispatch({ type: "cycleTab", delta });
}

export function closeTab(tabId: string) {
  dispatch({ type: "closeTab", tabId });
}

export function closeFocusedTab() {
  closeTab(focusedTab(getWorkspace()).id);
}

export function closeOtherTabs(tabId: string) {
  dispatch({ type: "closeOtherTabs", tabId });
}

export function closeTabsToRight(tabId: string) {
  dispatch({ type: "closeTabsToRight", tabId });
}

export function duplicateTab(tabId: string) {
  dispatch({ type: "duplicateTab", tabId });
}

export function reopenClosedTab() {
  dispatch({ type: "reopenClosedTab" });
}

/** Reorder a tab within its island. */
export function moveTab(tabId: string, islandId: string, index: number) {
  dispatch({ type: "moveTab", tabId, islandId, index });
}

export function pinTab(tabId: string, pinned: boolean) {
  dispatch({ type: "pinTab", tabId, pinned });
}

export function focusIsland(islandId: string) {
  dispatch({ type: "focusIsland", islandId });
}

/**
 * Focus the neighbouring island and move keyboard focus into its page, so
 * keys typed next land there rather than in the island just left.
 */
export function focusNeighbourIsland(direction: Direction) {
  const before = getWorkspace().focusedIslandId;
  dispatch({ type: "focusNeighbour", direction });
  if (getWorkspace().focusedIslandId !== before) focusPaneOfFocusedTab();
}

/** Open the island's selected page in a new island beside it (default: the focused island). */
export function splitIsland(side: Extract<Side, "right" | "bottom">, islandId?: string) {
  dispatch({ type: "splitIsland", side, islandId });
}

export function toggleMaximize(islandId?: string) {
  dispatch({ type: "toggleMaximize", islandId });
}

function focusPaneOfFocusedTab() {
  const id = focusedTab(getWorkspace()).id;
  requestAnimationFrame(() => {
    document.querySelector<HTMLElement>(`[data-tab-pane="${id}"]`)?.focus({ preventScroll: true });
  });
}

/** In-app href for an `<a>` the event landed in, or null if it isn't an internal link. */
export function internalLinkHref(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;
  const a = target.closest<HTMLAnchorElement>("a[href]");
  if (!a || a.hasAttribute("download")) return null;
  if (a.target && a.target !== "_self") return null;
  const url = new URL(a.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}
