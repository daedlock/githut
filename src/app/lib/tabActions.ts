import { getActiveTabRouter } from "@/app/lib/tabRouters";
import { useSettingsStore } from "@/app/stores/settings";
import {
  closeOthers,
  closeTab,
  closeToRight,
  getTabsSnapshot,
  moveTab,
  openTab,
  type TabsSnapshot,
  useTabsStore,
} from "@/app/stores/tabs";

// Imperative tab commands shared by the tab strip, keyboard shortcuts, the
// shift+click interceptor, the link hover menu and the command palette.
// Every tab stays mounted (TabHost), so these are pure state changes —
// switching tabs is just a visibility flip.

function apply(fn: (s: TabsSnapshot) => TabsSnapshot) {
  useTabsStore.getState().apply(fn);
}

export function tabsEnabled(): boolean {
  return useSettingsStore.getState().tabsEnabled;
}

/** Navigate the active tab (used when tabs are turned off). */
function navigateActive(href: string) {
  void getActiveTabRouter()?.navigate({ href });
}

export function openInNewTab(href: string, opts: { activate?: boolean } = {}) {
  if (!tabsEnabled()) return navigateActive(href);
  apply((s) => openTab(s, href, opts).state);
}

export function activateTab(id: string) {
  apply((s) =>
    s.activeId === id || !s.tabs.some((t) => t.id === id) ? s : { ...s, activeId: id },
  );
}

export function activateTabAt(index: number) {
  const { tabs } = getTabsSnapshot();
  const tab = index < 0 ? tabs[tabs.length - 1] : tabs[index];
  if (tab) activateTab(tab.id);
}

export function cycleTab(delta: 1 | -1) {
  const { tabs, activeId } = getTabsSnapshot();
  if (tabs.length < 2) return;
  const idx = tabs.findIndex((t) => t.id === activeId);
  activateTab(tabs[(idx + delta + tabs.length) % tabs.length]!.id);
}

export function closeTabById(id: string) {
  apply((s) => closeTab(s, id));
}

export function closeActiveTab() {
  const { activeId } = getTabsSnapshot();
  if (activeId) closeTabById(activeId);
}

export function closeOtherTabs(id: string) {
  apply((s) => closeOthers(s, id));
}

export function closeTabsToRight(id: string) {
  apply((s) => closeToRight(s, id));
}

export function duplicateTab(id: string) {
  const tab = getTabsSnapshot().tabs.find((t) => t.id === id);
  if (tab) apply((s) => openTab({ ...s, activeId: id }, tab.href, { allowDuplicate: true }).state);
}

export function reopenClosedTab() {
  const href = getTabsSnapshot().closed.at(-1);
  if (href) apply((s) => openTab({ ...s, closed: s.closed.slice(0, -1) }, href).state);
}

export function reorderTabs(from: number, to: number) {
  apply((s) => moveTab(s, from, to));
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
