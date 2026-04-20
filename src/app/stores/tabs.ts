import { create } from "zustand";
import { persist } from "zustand/middleware";

// ─── Types ───────────────────────────────────────────────────────────────────

export type Tab = {
  /** Tab identity = pathname (no search params). Used for reuse-or-open matching. */
  id: string;
  /** Full URL the tab points to (pathname + search + hash). */
  href: string;
  /** User-facing label ("Code", "PR #42", "Settings"). */
  label: string;
  /** Secondary label, typically "owner/repo". */
  sublabel?: string;
  /** Lucide icon key. */
  icon: string;
  /** Pinned tabs can't be auto-evicted. */
  pinned: boolean;
  /** Saved scroll position for this tab's content. */
  scrollY: number;
  /** Last time this tab was focused (ms). Used for LRU eviction. */
  lastFocusedAt: number;
  /** Panel group this tab belongs to. Phase 1: always "main". */
  groupId: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MAX_TABS = 20;
const DEFAULT_GROUP = "main";

/** Extract pathname from a full href string. This is the tab's matching key. */
export function hrefToTabId(href: string): string {
  try {
    const url = new URL(href, "http://localhost");
    // Normalize: strip trailing slash (except for "/")
    const p = url.pathname;
    return p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p;
  } catch {
    return href;
  }
}

/** Extract pathname + search + hash from a potentially full URL. */
function normalizeHref(href: string): string {
  try {
    const url = new URL(href, "http://localhost");
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return href.startsWith("/") ? href : `/${href}`;
  }
}

// ─── Store ───────────────────────────────────────────────────────────────────

type TabsState = {
  tabs: Tab[];
  activeTabId: string | null;

  /**
   * Core navigation action — reuse-or-open.
   * If a tab with the same pathname exists, focus it and update its href.
   * Otherwise create a new tab and focus it.
   * Returns the tab ID.
   */
  openTab: (href: string, meta?: { label?: string; sublabel?: string; icon?: string }) => string;

  /** Focus an existing tab by ID. */
  focusTab: (id: string) => void;

  /** Close a tab. Focuses the neighbor. */
  closeTab: (id: string) => void;

  /** Update the href (search params changed) without creating a new tab. */
  updateTabHref: (id: string, href: string) => void;

  /** Reorder a tab from one position to another. */
  moveTab: (fromIndex: number, toIndex: number) => void;

  /** Pin or unpin a tab. */
  togglePin: (id: string) => void;

  /** Save scroll position for a tab. */
  saveScroll: (id: string, scrollY: number) => void;

  /** Close all tabs except the given one. */
  closeOthers: (id: string) => void;

  /** Close all tabs to the right of the given one. */
  closeToRight: (id: string) => void;

  // ─── Phase 2 stubs ──────────────────────────────────────────────────────
  /** Panel groups. Phase 1: single "main" group. */
  groups: Record<string, { tabIds: string[] }>;
  activeGroupId: string;
};

export const useTabsStore = create<TabsState>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,
      groups: { [DEFAULT_GROUP]: { tabIds: [] } },
      activeGroupId: DEFAULT_GROUP,

      openTab: (rawHref, meta) => {
        const href = normalizeHref(rawHref);
        const id = hrefToTabId(href);
        const { tabs, activeTabId } = get();
        const existing = tabs.find((t) => t.id === id);

        if (existing) {
          // Reuse: focus existing tab, update its href (search params may differ).
          set({
            tabs: tabs.map((t) =>
              t.id === id
                ? {
                    ...t,
                    href,
                    lastFocusedAt: Date.now(),
                    // Update label/sublabel if new metadata is provided
                    ...(meta?.label ? { label: meta.label } : {}),
                    ...(meta?.sublabel ? { sublabel: meta.sublabel } : {}),
                    ...(meta?.icon ? { icon: meta.icon } : {}),
                  }
                : t,
            ),
            activeTabId: id,
          });
          return id;
        }

        // Open new tab. Auto-evict if over limit.
        let nextTabs = [...tabs];
        if (nextTabs.length >= MAX_TABS) {
          // Evict the oldest unpinned, non-active tab.
          const evictable = nextTabs
            .filter((t) => !t.pinned && t.id !== activeTabId)
            .sort((a, b) => a.lastFocusedAt - b.lastFocusedAt);
          if (evictable.length > 0) {
            nextTabs = nextTabs.filter((t) => t.id !== evictable[0]!.id);
          }
        }

        const newTab: Tab = {
          id,
          href,
          label: meta?.label ?? id.split("/").pop() ?? "Tab",
          sublabel: meta?.sublabel,
          icon: meta?.icon ?? "File",
          pinned: false,
          scrollY: 0,
          lastFocusedAt: Date.now(),
          groupId: DEFAULT_GROUP,
        };

        nextTabs.push(newTab);
        set({ tabs: nextTabs, activeTabId: id });
        return id;
      },

      focusTab: (id) => {
        const { tabs } = get();
        const exists = tabs.some((t) => t.id === id);
        if (!exists) return;
        set({
          tabs: tabs.map((t) => (t.id === id ? { ...t, lastFocusedAt: Date.now() } : t)),
          activeTabId: id,
        });
      },

      closeTab: (id) => {
        const { tabs, activeTabId } = get();
        const idx = tabs.findIndex((t) => t.id === id);
        if (idx === -1) return;

        const nextTabs = tabs.filter((t) => t.id !== id);

        // If we're closing the active tab, focus a neighbor.
        let nextActive = activeTabId;
        if (activeTabId === id) {
          if (nextTabs.length === 0) {
            nextActive = null;
          } else {
            // Prefer the tab to the right, then the left.
            const neighborIdx = Math.min(idx, nextTabs.length - 1);
            nextActive = nextTabs[neighborIdx]!.id;
          }
        }

        set({ tabs: nextTabs, activeTabId: nextActive });
      },

      updateTabHref: (id, rawHref) => {
        const href = normalizeHref(rawHref);
        set({
          tabs: get().tabs.map((t) => (t.id === id ? { ...t, href } : t)),
        });
      },

      moveTab: (fromIndex, toIndex) => {
        const tabs = [...get().tabs];
        if (fromIndex < 0 || fromIndex >= tabs.length) return;
        if (toIndex < 0 || toIndex >= tabs.length) return;
        const [moved] = tabs.splice(fromIndex, 1);
        tabs.splice(toIndex, 0, moved!);
        set({ tabs });
      },

      togglePin: (id) => {
        set({
          tabs: get().tabs.map((t) => (t.id === id ? { ...t, pinned: !t.pinned } : t)),
        });
      },

      saveScroll: (id, scrollY) => {
        set({
          tabs: get().tabs.map((t) => (t.id === id ? { ...t, scrollY } : t)),
        });
      },

      closeOthers: (id) => {
        const tabs = get().tabs.filter((t) => t.id === id || t.pinned);
        set({ tabs, activeTabId: id });
      },

      closeToRight: (id) => {
        const { tabs } = get();
        const idx = tabs.findIndex((t) => t.id === id);
        if (idx === -1) return;
        const kept = tabs.filter((t, i) => i <= idx || t.pinned);
        set({ tabs: kept });
      },
    }),
    {
      name: "githut.tabs.v1",
      partialize: (state) => ({
        tabs: state.tabs,
        activeTabId: state.activeTabId,
      }),
    },
  ),
);

// ─── Convenience hooks ───────────────────────────────────────────────────────

/** Get the currently active tab, or null. */
export function useActiveTab(): Tab | null {
  return useTabsStore((s) => {
    if (!s.activeTabId) return null;
    return s.tabs.find((t) => t.id === s.activeTabId) ?? null;
  });
}

/** Get the tab for a specific ID, or undefined. */
export function useTab(id: string): Tab | undefined {
  return useTabsStore((s) => s.tabs.find((t) => t.id === id));
}
