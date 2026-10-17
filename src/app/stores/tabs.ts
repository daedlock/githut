import { create } from "zustand";
import { persist } from "zustand/middleware";

// ─── Model ───────────────────────────────────────────────────────────────────
//
// Editor-style tabs. Every tab owns a router with its own in-memory history
// and stays mounted while hidden (see TabHost), so switching is instant and
// each tab keeps its scroll, expanded sections and drafts. Ordinary navigation
// moves the tab it happens in; only explicit actions open a new one.
//
// Label/icon are not stored — they're derived from the href at render time
// (see `getTabMeta`), so they can't go stale.

export type Tab = {
  id: string;
  /** pathname + search + hash */
  href: string;
};

export type TabsSnapshot = {
  tabs: Tab[];
  activeId: string | null;
  /** Most recently closed hrefs, newest last. Session-only. */
  closed: string[];
};

const MAX_TABS = 24;
const MAX_CLOSED = 10;

let idCounter = 0;
function newId(): string {
  idCounter += 1;
  return `${Date.now().toString(36)}${idCounter.toString(36)}`;
}

/** Normalize anything href-like to `pathname + search + hash`. */
export function normalizeHref(href: string): string {
  try {
    const url = new URL(href, "http://localhost");
    const p = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : url.pathname;
    return `${p}${url.search}${url.hash}`;
  } catch {
    return href.startsWith("/") ? href : `/${href}`;
  }
}

export function hrefPathname(href: string): string {
  return normalizeHref(href).split(/[?#]/)[0]!;
}

// ─── Pure transitions (exported for tests) ──────────────────────────────────

/** Point the active tab at `href`. Creates the first tab if there are none. */
export function syncActive(s: TabsSnapshot, rawHref: string): TabsSnapshot {
  const href = normalizeHref(rawHref);
  const active = s.tabs.find((t) => t.id === s.activeId);
  if (!active) {
    const tab = { id: newId(), href };
    return { ...s, tabs: [...s.tabs, tab], activeId: tab.id };
  }
  if (active.href === href) return s;
  return { ...s, tabs: s.tabs.map((t) => (t.id === active.id ? { ...t, href } : t)) };
}

/** Record where a tab's own router has navigated to. */
export function setTabHref(s: TabsSnapshot, id: string, rawHref: string): TabsSnapshot {
  const href = normalizeHref(rawHref);
  const tab = s.tabs.find((t) => t.id === id);
  if (!tab || tab.href === href) return s;
  return { ...s, tabs: s.tabs.map((t) => (t.id === id ? { ...t, href } : t)) };
}

/**
 * Open `href` in a new tab right after the active one. If a tab already shows
 * the same page (pathname), that tab is reused instead of duplicated.
 */
export function openTab(
  s: TabsSnapshot,
  rawHref: string,
  opts: { activate?: boolean; allowDuplicate?: boolean } = {},
): { state: TabsSnapshot; id: string } {
  const href = normalizeHref(rawHref);
  const activate = opts.activate ?? true;

  if (!opts.allowDuplicate) {
    const path = hrefPathname(href);
    const existing = s.tabs.find((t) => hrefPathname(t.href) === path);
    if (existing) {
      const tabs = s.tabs.map((t) => (t.id === existing.id ? { ...t, href } : t));
      return {
        state: { ...s, tabs, activeId: activate ? existing.id : s.activeId },
        id: existing.id,
      };
    }
  }

  const tab: Tab = { id: newId(), href };
  const activeIdx = s.tabs.findIndex((t) => t.id === s.activeId);
  let tabs = [...s.tabs];
  tabs.splice(activeIdx === -1 ? tabs.length : activeIdx + 1, 0, tab);

  // Over the cap: drop the left-most tab that isn't involved in this action.
  if (tabs.length > MAX_TABS) {
    const victim = tabs.find((t) => t.id !== s.activeId && t.id !== tab.id);
    if (victim) tabs = tabs.filter((t) => t.id !== victim.id);
  }

  return { state: { ...s, tabs, activeId: activate ? tab.id : s.activeId }, id: tab.id };
}

function pushClosed(closed: string[], hrefs: string[]): string[] {
  return [...closed, ...hrefs].slice(-MAX_CLOSED);
}

/** Close a tab. Closing the active tab focuses its right neighbour, else the left. */
export function closeTab(s: TabsSnapshot, id: string): TabsSnapshot {
  const idx = s.tabs.findIndex((t) => t.id === id);
  if (idx === -1 || s.tabs.length <= 1) return s;
  const tabs = s.tabs.filter((t) => t.id !== id);
  const activeId = s.activeId === id ? tabs[Math.min(idx, tabs.length - 1)]!.id : s.activeId;
  return { tabs, activeId, closed: pushClosed(s.closed, [s.tabs[idx]!.href]) };
}

export function closeOthers(s: TabsSnapshot, id: string): TabsSnapshot {
  const keep = s.tabs.find((t) => t.id === id);
  if (!keep) return s;
  const gone = s.tabs.filter((t) => t.id !== id).map((t) => t.href);
  return { tabs: [keep], activeId: id, closed: pushClosed(s.closed, gone) };
}

export function closeToRight(s: TabsSnapshot, id: string): TabsSnapshot {
  const idx = s.tabs.findIndex((t) => t.id === id);
  if (idx === -1) return s;
  const tabs = s.tabs.slice(0, idx + 1);
  const gone = s.tabs.slice(idx + 1).map((t) => t.href);
  const activeId = tabs.some((t) => t.id === s.activeId) ? s.activeId : id;
  return { tabs, activeId, closed: pushClosed(s.closed, gone) };
}

export function moveTab(s: TabsSnapshot, from: number, to: number): TabsSnapshot {
  if (from === to || from < 0 || to < 0 || from >= s.tabs.length || to >= s.tabs.length) return s;
  const tabs = [...s.tabs];
  const [moved] = tabs.splice(from, 1);
  tabs.splice(to, 0, moved!);
  return { ...s, tabs };
}

// ─── Store ───────────────────────────────────────────────────────────────────

type TabsState = TabsSnapshot & {
  apply: (fn: (s: TabsSnapshot) => TabsSnapshot) => void;
};

function snapshot(s: TabsState): TabsSnapshot {
  return { tabs: s.tabs, activeId: s.activeId, closed: s.closed };
}

export const useTabsStore = create<TabsState>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeId: null,
      closed: [],
      apply: (fn) => {
        const prev = snapshot(get());
        const next = fn(prev);
        if (next !== prev) set(next);
      },
    }),
    {
      name: "githut.tabs.v3",
      partialize: (s) => ({ tabs: s.tabs, activeId: s.activeId }),
    },
  ),
);

export function getTabsSnapshot(): TabsSnapshot {
  return snapshot(useTabsStore.getState());
}
