import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { getTabMeta } from "@/app/lib/tabMeta";
import { useSettingsStore } from "@/app/stores/settings";
import { hrefToTabId, useTabsStore } from "@/app/stores/tabs";

/**
 * Bidirectional URL ↔ tab sync.
 *
 * Direction 1 — URL changes (user types URL, browser back/forward, Link click):
 *   Router state updates → we call openTab(href) → tab bar reflects it.
 *
 * Direction 2 — Tab focused (workspace state changes):
 *   Store updates activeTabId → we call router.navigate(tab.href) → Outlet renders.
 *
 * Loop prevention: a ref tracks which direction initiated the current change.
 * Each direction's effect bails out if the other direction is the source.
 */

const IGNORED_PATHS = new Set(["/login", "/playground"]);

type SyncSource = "url" | "tab" | null;

export function TabSyncProvider({ children }: { children: React.ReactNode }) {
  const tabsEnabled = useSettingsStore((s) => s.tabsEnabled);
  const navigate = useNavigate();
  const href = useRouterState({
    select: (s) => `${s.location.pathname}${s.location.searchStr}${s.location.hash}`,
  });
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const syncSource = useRef<SyncSource>(null);
  const prevHref = useRef(href);
  const prevActiveTabId = useRef(useTabsStore.getState().activeTabId);

  // ─── Direction 1: URL → Tab ──────────────────────────────────────────────
  // When the URL changes externally, open/focus the corresponding tab.
  useEffect(() => {
    if (!tabsEnabled) return;

    // Skip if this URL change was caused by us (tab → URL sync).
    if (syncSource.current === "tab") {
      syncSource.current = null;
      prevHref.current = href;
      return;
    }

    // Don't create tabs for ignored routes.
    if (IGNORED_PATHS.has(pathname)) {
      prevHref.current = href;
      return;
    }

    const tabId = hrefToTabId(href);
    const store = useTabsStore.getState();
    const existingTab = store.tabs.find((t) => t.id === tabId);

    syncSource.current = "url";

    if (existingTab) {
      // Tab exists — focus it and update href (search params may have changed).
      store.focusTab(tabId);
      if (existingTab.href !== href) {
        store.updateTabHref(tabId, href);
      }
    } else {
      // New route — create a tab with metadata derived from the pathname.
      const meta = getTabMeta(pathname);
      store.openTab(href, {
        label: meta.label,
        sublabel: meta.sublabel,
        icon: meta.icon.displayName ?? meta.icon.name ?? "File",
      });
    }

    syncSource.current = null;
    prevHref.current = href;
  }, [href, pathname, tabsEnabled]);

  // ─── Direction 2: Tab → URL ──────────────────────────────────────────────
  // When the active tab changes via the store (user clicks a tab), navigate the router.
  useEffect(() => {
    if (!tabsEnabled) return;

    const unsubscribe = useTabsStore.subscribe((state) => {
      const { activeTabId, tabs } = state;

      // Only act when the active tab actually changed.
      if (activeTabId === prevActiveTabId.current) return;
      prevActiveTabId.current = activeTabId;

      // Skip if this change was caused by URL → tab sync.
      if (syncSource.current === "url") return;

      if (!activeTabId) return;
      const tab = tabs.find((t) => t.id === activeTabId);
      if (!tab) return;

      // Don't navigate if we're already at this URL.
      if (tab.href === prevHref.current) return;

      syncSource.current = "tab";
      prevHref.current = tab.href;
      navigate({ to: tab.href });
    });

    return unsubscribe;
  }, [navigate, tabsEnabled]);

  // ─── Direction 2b: Tab closed → navigate to new active ────────────────────
  // When a tab is closed and focus transfers, navigate to the new active tab.
  // This is handled by the same subscription above — closeTab updates activeTabId,
  // which triggers the subscriber.

  return <>{children}</>;
}
