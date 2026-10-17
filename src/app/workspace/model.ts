// ─── Workspace model ─────────────────────────────────────────────────────────
//
// A pure model of everything one browser window shows (GLOSSARY → Workspace):
// the layout tree of islands and splits, each island's tabs and selected tab,
// and the focused island. Nothing here touches React, storage or the DOM.
//
// Every change is a named command run through `runCommand`, which applies it
// and then normalises the tree:
//
//   - islands without tabs are removed, so their space goes to neighbours;
//   - splits with one child collapse into that child;
//   - a split nested in a split of the same direction is flattened, its
//     sizes multiplied through;
//   - sizes are renormalised to sum to 1, and the selected tab, the focused
//     island and the maximized island always point at something that exists.
//
// Untouched subtrees keep their object identity, so the renderer can skip
// islands a command didn't change.

// ─── Shape ───────────────────────────────────────────────────────────────────

import { applyDock, type DockingCommand } from "@/app/workspace/docking";

export type Tab = {
  id: string;
  /** pathname + search + hash */
  href: string;
};

export type Island = {
  kind: "island";
  id: string;
  tabs: Tab[];
  selectedTabId: string;
  /** Ids of pinned tabs (GLOSSARY → Pinned tab). */
  pinned: string[];
};

export type SplitDirection = "row" | "column";

export type Split = {
  kind: "split";
  id: string;
  /** `row` lays children out left → right, `column` top → bottom. */
  direction: SplitDirection;
  children: LayoutNode[];
  /** Relative sizes along `direction`; they sum to 1. */
  sizes: number[];
};

export type LayoutNode = Island | Split;

export type Workspace = {
  layout: LayoutNode;
  focusedIslandId: string;
  /** Island ids in most recently focused order, focused island first. */
  focusHistory: string[];
  /**
   * Island shown alone, filling the workspace. Only rendering changes: the
   * layout keeps every size, so restoring returns to exactly where it was.
   */
  maximizedIslandId: string | null;
  /** Most recently closed hrefs, newest last. Session-only. */
  closed: string[];
};

export type Side = "left" | "right" | "top" | "bottom";
export type Direction = "left" | "right" | "up" | "down";

/** Minimum island size in px (spec #24). */
export const MIN_ISLAND_WIDTH = 320;
export const MIN_ISLAND_HEIGHT = 200;
/** Gap between islands in px (DESIGN.md → Islands). */
export const ISLAND_GAP = 8;

/** The page a workspace opens to when it has nothing else to show. */
export const HOME_HREF = "/";

const MAX_CLOSED = 10;

// ─── Commands ────────────────────────────────────────────────────────────────

export type WorkspaceCommand =
  | DockingCommand
  | { type: "closeIsland"; islandId: string }
  /** A tab's own router moved (in-page link, back/forward). */
  | { type: "navigate"; tabId: string; href: string }
  /** Open `href` as a new tab after the selected tab of an island (default: the focused one). */
  | {
      type: "openTab";
      href: string;
      islandId?: string;
      /** Select it and focus its island (default true). */
      select?: boolean;
      /** Open a second tab even if the island already shows this page. */
      allowDuplicate?: boolean;
      /** Exact href matching keeps different code files/search states as separate pages. */
      match?: "pathname" | "href";
    }
  /** Launchers and incoming URLs jump to a matching page, preferring recent islands. */
  | { type: "openOrJump"; href: string }
  | { type: "openUrl"; href: string }
  /** Open a page in a new island to the right of the source (default: focused island). */
  | { type: "openToSide"; href: string; islandId?: string }
  | { type: "selectTab"; tabId: string }
  /** Select the n-th tab of the focused island; -1 is the last. */
  | { type: "selectTabAt"; index: number }
  /** Select the next/previous tab of the focused island, wrapping. */
  | { type: "cycleTab"; delta: 1 | -1 }
  | { type: "moveTab"; tabId: string; islandId: string; index: number }
  | { type: "duplicateTab"; tabId: string }
  | { type: "closeTab"; tabId: string }
  | { type: "closeOtherTabs"; tabId: string }
  | { type: "closeTabsToRight"; tabId: string }
  | { type: "reopenClosedTab" }
  | { type: "focusIsland"; islandId: string }
  /** Focus the island next to the focused one, by position on screen. */
  | { type: "focusNeighbour"; direction: Direction }
  /** Open the island's selected page in a new island beside it, and focus that. */
  | { type: "splitIsland"; islandId?: string; side: Side }
  /**
   * Move the gap between `children[gap]` and `children[gap + 1]` of a split
   * by `delta` px (positive = right/down), or to the furthest it can go
   * (`"start"` / `"end"`). `extent` is the split's size in px along its
   * direction, gaps included. Never shrinks a child below its minimum.
   */
  | {
      type: "resizeGap";
      splitId: string;
      gap: number;
      delta: number | "start" | "end";
      extent: number;
    }
  | { type: "equalizeSplit"; splitId: string }
  | { type: "toggleMaximize"; islandId?: string };

/** Apply a command and normalise. Returns the same object when nothing changed. */
export function runCommand(ws: Workspace, cmd: WorkspaceCommand): Workspace {
  const next = apply(ws, cmd);
  return next === ws ? ws : normalizeWorkspace(next);
}

function apply(ws: Workspace, cmd: WorkspaceCommand): Workspace {
  switch (cmd.type) {
    case "dock":
      return applyDock(ws, cmd.source, cmd.target);

    case "closeIsland": {
      const island = findIsland(ws.layout, cmd.islandId);
      return island
        ? closeTabs(
            ws,
            island.tabs.map((t) => t.id),
          )
        : ws;
    }

    case "navigate": {
      const href = normalizeHref(cmd.href);
      return updateTab(ws, cmd.tabId, (t) => (t.href === href ? t : { ...t, href }));
    }

    case "openTab":
      return openTab(ws, cmd.href, cmd.islandId ?? ws.focusedIslandId, {
        select: cmd.select ?? true,
        allowDuplicate: cmd.allowDuplicate ?? false,
        match: cmd.match,
      });

    case "openOrJump":
    case "openUrl": {
      const href = normalizeHref(cmd.href);
      for (const id of ws.focusHistory) {
        const match = findIsland(ws.layout, id)?.tabs.find((t) => t.href === href);
        if (match) return selectTab(ws, match.id);
      }
      return openTab(ws, href, ws.focusedIslandId, { select: true, allowDuplicate: true });
    }

    case "openToSide": {
      const source = cmd.islandId ?? ws.focusedIslandId;
      if (!findIsland(ws.layout, source)) return ws;
      const island = newIsland([cmd.href]);
      return {
        ...ws,
        layout: insertBeside(ws.layout, source, "right", island),
        focusedIslandId: island.id,
        maximizedIslandId: null,
      };
    }

    case "selectTab":
      return selectTab(ws, cmd.tabId);

    case "selectTabAt": {
      const island = findIsland(ws.layout, ws.focusedIslandId);
      const tab = island && (cmd.index < 0 ? island.tabs.at(-1) : island.tabs[cmd.index]);
      return tab ? selectTab(ws, tab.id) : ws;
    }

    case "cycleTab": {
      const island = findIsland(ws.layout, ws.focusedIslandId);
      if (!island || island.tabs.length < 2) return ws;
      const idx = island.tabs.findIndex((t) => t.id === island.selectedTabId);
      const n = island.tabs.length;
      return selectTab(ws, island.tabs[(idx + cmd.delta + n) % n]!.id);
    }

    case "moveTab":
      return moveTab(ws, cmd.tabId, cmd.islandId, cmd.index);

    case "duplicateTab": {
      const found = findTab(ws.layout, cmd.tabId);
      if (!found) return ws;
      const island = { ...found.island, selectedTabId: cmd.tabId };
      const withSelected = { ...ws, layout: replaceNode(ws.layout, island.id, island) };
      return openTab(withSelected, found.tab.href, island.id, {
        select: true,
        allowDuplicate: true,
      });
    }

    case "closeTab":
      return closeTabs(ws, [cmd.tabId]);

    case "closeOtherTabs": {
      const found = findTab(ws.layout, cmd.tabId);
      if (!found) return ws;
      const gone = found.island.tabs.filter((t) => t.id !== cmd.tabId).map((t) => t.id);
      return selectTab(closeTabs(ws, gone), cmd.tabId);
    }

    case "closeTabsToRight": {
      const found = findTab(ws.layout, cmd.tabId);
      if (!found) return ws;
      const idx = found.island.tabs.findIndex((t) => t.id === cmd.tabId);
      const gone = found.island.tabs.slice(idx + 1).map((t) => t.id);
      return closeTabs(ws, gone);
    }

    case "reopenClosedTab": {
      const href = ws.closed.at(-1);
      if (!href) return ws;
      return openTab({ ...ws, closed: ws.closed.slice(0, -1) }, href, ws.focusedIslandId, {
        select: true,
        allowDuplicate: false,
      });
    }

    case "focusIsland":
      return focusIsland(ws, cmd.islandId);

    case "focusNeighbour": {
      const id = neighbourIsland(ws.layout, ws.focusedIslandId, cmd.direction);
      return id ? focusIsland(ws, id) : ws;
    }

    case "splitIsland": {
      const target = findIsland(ws.layout, cmd.islandId ?? ws.focusedIslandId);
      const selected = target?.tabs.find((t) => t.id === target.selectedTabId);
      if (!target || !selected) return ws;
      const island = newIsland([selected.href]);
      return {
        ...ws,
        layout: insertBeside(ws.layout, target.id, cmd.side, island),
        focusedIslandId: island.id,
        maximizedIslandId: null,
      };
    }

    case "resizeGap": {
      const split = findSplit(ws.layout, cmd.splitId);
      if (!split) return ws;
      const sizes = resizedGapSizes(split, cmd.gap, cmd.delta, cmd.extent);
      return sizes === split.sizes
        ? ws
        : { ...ws, layout: replaceNode(ws.layout, split.id, { ...split, sizes }) };
    }

    case "equalizeSplit": {
      const split = findSplit(ws.layout, cmd.splitId);
      if (!split) return ws;
      const even = 1 / split.children.length;
      if (split.sizes.every((s) => Math.abs(s - even) < 1e-9)) return ws;
      const sizes = split.children.map(() => even);
      return { ...ws, layout: replaceNode(ws.layout, split.id, { ...split, sizes }) };
    }

    case "toggleMaximize": {
      const id = cmd.islandId ?? ws.focusedIslandId;
      if (!findIsland(ws.layout, id)) return ws;
      // A lone island has nothing to maximize over.
      if (ws.layout.kind === "island")
        return ws.maximizedIslandId ? { ...ws, maximizedIslandId: null } : ws;
      return {
        ...ws,
        focusedIslandId: id,
        maximizedIslandId: ws.maximizedIslandId === id ? null : id,
      };
    }
  }
}

// ─── Construction ────────────────────────────────────────────────────────────

let idCounter = 0;
export function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}${Date.now().toString(36)}${idCounter.toString(36)}`;
}

export function newTab(href: string): Tab {
  return { id: newId("t"), href: normalizeHref(href) };
}

export function newIsland(hrefs: string[], selectedIndex = 0): Island {
  const tabs = (hrefs.length ? hrefs : [HOME_HREF]).map(newTab);
  const selected = tabs[Math.min(Math.max(selectedIndex, 0), tabs.length - 1)]!;
  return { kind: "island", id: newId("i"), tabs, selectedTabId: selected.id, pinned: [] };
}

export function newSplit(
  direction: SplitDirection,
  children: LayoutNode[],
  sizes?: number[],
): Split {
  return {
    kind: "split",
    id: newId("s"),
    direction,
    children,
    sizes: sizes ?? children.map(() => 1 / children.length),
  };
}

/** A workspace of one island with these tabs. */
export function createWorkspace(hrefs: string[], selectedIndex = 0): Workspace {
  const island = newIsland(hrefs, selectedIndex);
  return {
    layout: island,
    focusedIslandId: island.id,
    focusHistory: [island.id],
    maximizedIslandId: null,
    closed: [],
  };
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/** Islands in tree order (left → right, top → bottom). */
export function islands(node: LayoutNode): Island[] {
  if (node.kind === "island") return [node];
  return node.children.flatMap(islands);
}

export function findIsland(node: LayoutNode, id: string): Island | undefined {
  if (node.kind === "island") return node.id === id ? node : undefined;
  for (const child of node.children) {
    const hit = findIsland(child, id);
    if (hit) return hit;
  }
  return undefined;
}

export function findSplit(node: LayoutNode, id: string): Split | undefined {
  if (node.kind === "island") return undefined;
  if (node.id === id) return node;
  for (const child of node.children) {
    const hit = findSplit(child, id);
    if (hit) return hit;
  }
  return undefined;
}

export function findTab(node: LayoutNode, tabId: string): { island: Island; tab: Tab } | undefined {
  for (const island of islands(node)) {
    const tab = island.tabs.find((t) => t.id === tabId);
    if (tab) return { island, tab };
  }
  return undefined;
}

export function selectedTab(island: Island): Tab {
  return island.tabs.find((t) => t.id === island.selectedTabId) ?? island.tabs[0]!;
}

export function focusedIsland(ws: Workspace): Island {
  return findIsland(ws.layout, ws.focusedIslandId) ?? islands(ws.layout)[0]!;
}

/** The focused island's selected tab (GLOSSARY → Focused island). */
export function focusedTab(ws: Workspace): Tab {
  return selectedTab(focusedIsland(ws));
}

/** Ids of the nodes from the root down to `id`, inclusive; empty if absent. */
export function pathTo(node: LayoutNode, id: string): string[] {
  if (node.id === id) return [node.id];
  if (node.kind === "island") return [];
  for (const child of node.children) {
    const rest = pathTo(child, id);
    if (rest.length) return [node.id, ...rest];
  }
  return [];
}

/** Smallest size in px a node can take along an axis, gaps included. */
export function minNodeSize(node: LayoutNode, axis: "width" | "height"): number {
  const own = axis === "width" ? MIN_ISLAND_WIDTH : MIN_ISLAND_HEIGHT;
  if (node.kind === "island") return own;
  const mins = node.children.map((c) => minNodeSize(c, axis));
  const along = (node.direction === "row") === (axis === "width");
  return along
    ? mins.reduce((a, b) => a + b, 0) + ISLAND_GAP * (mins.length - 1)
    : Math.max(...mins);
}

/**
 * Sizes after moving one gap of a split (see the `resizeGap` command). Only
 * the two children beside the gap change, and their sum is preserved.
 * Returns `split.sizes` itself when nothing moves.
 */
export function resizedGapSizes(
  split: Split,
  gap: number,
  delta: number | "start" | "end",
  extent: number,
): number[] {
  const a = split.children[gap];
  const b = split.children[gap + 1];
  const net = extent - ISLAND_GAP * (split.children.length - 1);
  if (!a || !b || net <= 0) return split.sizes;
  const axis = split.direction === "row" ? "width" : "height";
  const pair = split.sizes[gap]! + split.sizes[gap + 1]!;
  const lo = minNodeSize(a, axis) / net;
  const hi = pair - minNodeSize(b, axis) / net;
  // Too small to honour both minimums: leave it for narrow mode to handle.
  if (lo > hi) return split.sizes;
  const wanted = delta === "start" ? lo : delta === "end" ? hi : split.sizes[gap]! + delta / net;
  const sizeA = Math.min(Math.max(wanted, lo), hi);
  if (Math.abs(sizeA - split.sizes[gap]!) < 1e-9) return split.sizes;
  const sizes = [...split.sizes];
  sizes[gap] = sizeA;
  sizes[gap + 1] = pair - sizeA;
  return sizes;
}

type Rect = { x0: number; y0: number; x1: number; y1: number };

/** Each island's rectangle in a unit square, from the split sizes. */
export function islandRects(node: LayoutNode, rect: Rect = { x0: 0, y0: 0, x1: 1, y1: 1 }) {
  const out = new Map<string, Rect>();
  const walk = (n: LayoutNode, r: Rect) => {
    if (n.kind === "island") {
      out.set(n.id, r);
      return;
    }
    let at = n.direction === "row" ? r.x0 : r.y0;
    const span = n.direction === "row" ? r.x1 - r.x0 : r.y1 - r.y0;
    n.children.forEach((child, i) => {
      const end = at + span * n.sizes[i]!;
      walk(child, n.direction === "row" ? { ...r, x0: at, x1: end } : { ...r, y0: at, y1: end });
      at = end;
    });
  };
  walk(node, rect);
  return out;
}

/**
 * The island next to `fromId` in a direction: among islands lying that way
 * and overlapping it across the other axis, the nearest; ties go to the one
 * level with the island's centre, then to the larger overlap.
 */
export function neighbourIsland(
  layout: LayoutNode,
  fromId: string,
  direction: Direction,
): string | null {
  const rects = islandRects(layout);
  const from = rects.get(fromId);
  if (!from) return null;
  const eps = 1e-6;
  const horizontal = direction === "left" || direction === "right";
  const centre = horizontal ? (from.y0 + from.y1) / 2 : (from.x0 + from.x1) / 2;
  let best: { id: string; dist: number; level: boolean; overlap: number } | null = null;

  for (const [id, r] of rects) {
    if (id === fromId) continue;
    const dist =
      direction === "right"
        ? r.x0 - from.x1
        : direction === "left"
          ? from.x0 - r.x1
          : direction === "down"
            ? r.y0 - from.y1
            : from.y0 - r.y1;
    if (dist < -eps) continue;
    const [a0, a1, b0, b1] = horizontal
      ? [from.y0, from.y1, r.y0, r.y1]
      : [from.x0, from.x1, r.x0, r.x1];
    const overlap = Math.min(a1, b1) - Math.max(a0, b0);
    if (overlap <= eps) continue;
    const level = b0 <= centre && centre <= b1;
    const better =
      !best ||
      dist < best.dist - eps ||
      (Math.abs(dist - best.dist) <= eps &&
        (level !== best.level ? level : overlap > best.overlap + eps));
    if (better) best = { id, dist, level, overlap };
  }
  return best?.id ?? null;
}

// ─── Hrefs ───────────────────────────────────────────────────────────────────

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

// ─── Transitions ─────────────────────────────────────────────────────────────

export function replaceNode(node: LayoutNode, id: string, next: LayoutNode): LayoutNode {
  if (node.id === id) return next;
  if (node.kind === "island") return node;
  let changed = false;
  const children = node.children.map((c) => {
    const r = replaceNode(c, id, next);
    if (r !== c) changed = true;
    return r;
  });
  return changed ? { ...node, children } : node;
}

function mapIslands(node: LayoutNode, fn: (island: Island) => Island): LayoutNode {
  if (node.kind === "island") return fn(node);
  let changed = false;
  const children = node.children.map((c) => {
    const r = mapIslands(c, fn);
    if (r !== c) changed = true;
    return r;
  });
  return changed ? { ...node, children } : node;
}

function updateTab(ws: Workspace, tabId: string, fn: (tab: Tab) => Tab): Workspace {
  const found = findTab(ws.layout, tabId);
  if (!found) return ws;
  const tab = fn(found.tab);
  if (tab === found.tab) return ws;
  const island = {
    ...found.island,
    tabs: found.island.tabs.map((t) => (t.id === tabId ? tab : t)),
  };
  return { ...ws, layout: replaceNode(ws.layout, island.id, island) };
}

function focusIsland(ws: Workspace, islandId: string): Workspace {
  if (ws.focusedIslandId === islandId || !findIsland(ws.layout, islandId)) return ws;
  // Focusing an island hidden behind a maximized one restores the layout.
  const maximizedIslandId = ws.maximizedIslandId === islandId ? islandId : null;
  return { ...ws, focusedIslandId: islandId, maximizedIslandId };
}

function selectTab(ws: Workspace, tabId: string): Workspace {
  const found = findTab(ws.layout, tabId);
  if (!found) return ws;
  const focused = focusIsland(ws, found.island.id);
  if (found.island.selectedTabId === tabId) return focused;
  const island = { ...found.island, selectedTabId: tabId };
  return { ...focused, layout: replaceNode(focused.layout, island.id, island) };
}

function openTab(
  ws: Workspace,
  rawHref: string,
  islandId: string,
  opts: { select: boolean; allowDuplicate: boolean; match?: "pathname" | "href" },
): Workspace {
  const href = normalizeHref(rawHref);
  const island = findIsland(ws.layout, islandId) ?? focusedIsland(ws);

  // De-duplicated within the island only: the same page may be open in two
  // islands (e.g. a PR's conversation beside its files).
  if (!opts.allowDuplicate) {
    const path = hrefPathname(href);
    const existing = island.tabs.find((t) =>
      opts.match === "href" ? t.href === href : hrefPathname(t.href) === path,
    );
    if (existing) {
      const updated = updateTab(ws, existing.id, (t) => (t.href === href ? t : { ...t, href }));
      return opts.select ? selectTab(updated, existing.id) : updated;
    }
  }

  const tab = newTab(href);
  const idx = island.tabs.findIndex((t) => t.id === island.selectedTabId);
  const tabs = [...island.tabs];
  tabs.splice(idx === -1 ? tabs.length : idx + 1, 0, tab);
  const next = { ...ws, layout: replaceNode(ws.layout, island.id, { ...island, tabs }) };
  return opts.select ? selectTab(next, tab.id) : next;
}

function moveTab(ws: Workspace, tabId: string, toIslandId: string, index: number): Workspace {
  const found = findTab(ws.layout, tabId);
  const dest = findIsland(ws.layout, toIslandId);
  if (!found || !dest) return ws;
  const from = found.island.tabs.findIndex((t) => t.id === tabId);

  if (dest.id === found.island.id) {
    const to = Math.min(Math.max(index, 0), dest.tabs.length - 1);
    if (to === from) return ws;
    const tabs = [...dest.tabs];
    tabs.splice(from, 1);
    tabs.splice(to, 0, found.tab);
    return { ...ws, layout: replaceNode(ws.layout, dest.id, { ...dest, tabs }) };
  }

  const source = {
    ...found.island,
    tabs: found.island.tabs.filter((t) => t.id !== tabId),
    pinned: found.island.pinned.filter((id) => id !== tabId),
    selectedTabId: reselect(found.island, [tabId]),
  };
  const tabs = [...dest.tabs];
  tabs.splice(Math.min(Math.max(index, 0), tabs.length), 0, found.tab);
  let layout = replaceNode(ws.layout, source.id, source);
  layout = replaceNode(layout, dest.id, { ...dest, tabs, selectedTabId: tabId });
  return { ...ws, layout, focusedIslandId: dest.id };
}

/**
 * The tab an island should select once `gone` tabs leave it: the selected
 * tab if it stays, else its right neighbour, else its left.
 */
export function reselect(island: Island, gone: string[]): string {
  if (!gone.includes(island.selectedTabId)) return island.selectedTabId;
  const idx = island.tabs.findIndex((t) => t.id === island.selectedTabId);
  const right = island.tabs.slice(idx + 1).find((t) => !gone.includes(t.id));
  const left = island.tabs
    .slice(0, idx)
    .reverse()
    .find((t) => !gone.includes(t.id));
  return (right ?? left)?.id ?? "";
}

function closeTabs(ws: Workspace, tabIds: string[]): Workspace {
  if (!tabIds.length) return ws;
  const gone = new Set(tabIds);
  const closedHrefs: string[] = [];
  const emptied: string[] = [];

  const layout = mapIslands(ws.layout, (island) => {
    if (!island.tabs.some((t) => gone.has(t.id))) return island;
    for (const t of island.tabs) if (gone.has(t.id)) closedHrefs.push(t.href);
    const tabs = island.tabs.filter((t) => !gone.has(t.id));
    if (!tabs.length) emptied.push(island.id);
    return {
      ...island,
      tabs,
      pinned: island.pinned.filter((id) => !gone.has(id)),
      selectedTabId: reselect(island, tabIds),
    };
  });
  if (layout === ws.layout) return ws;

  const closed = [...ws.closed, ...closedHrefs].slice(-MAX_CLOSED);

  // The workspace always shows a page: its last tab can't be closed.
  if (islands(layout).every((i) => i.tabs.length === 0)) return ws;

  // A focused island that empties hands focus to the island taking its space.
  let focusedIslandId = ws.focusedIslandId;
  if (emptied.includes(focusedIslandId)) {
    focusedIslandId = heirOf(ws.layout, focusedIslandId, new Set(emptied)) ?? focusedIslandId;
  }
  return { ...ws, layout, closed, focusedIslandId };
}

/** The nearest surviving island to `id`: within its previous sibling, else its next. */
function heirOf(layout: LayoutNode, id: string, gone: Set<string>): string | undefined {
  const path = pathTo(layout, id);
  for (let depth = path.length - 2; depth >= 0; depth--) {
    const parent = findSplit(layout, path[depth]!);
    if (!parent) continue;
    const idx = parent.children.findIndex((c) => c.id === path[depth + 1]);
    const alive = (n: LayoutNode) => islands(n).filter((i) => !gone.has(i.id));
    for (let j = idx - 1; j >= 0; j--) {
      const hit = alive(parent.children[j]!).at(-1);
      if (hit) return hit.id;
    }
    for (let j = idx + 1; j < parent.children.length; j++) {
      const hit = alive(parent.children[j]!)[0];
      if (hit) return hit.id;
    }
  }
  return undefined;
}

/** Place `node` beside `targetId`, taking half of the target's space. */
export function insertBeside(
  layout: LayoutNode,
  targetId: string,
  side: Side,
  node: LayoutNode,
): LayoutNode {
  const direction: SplitDirection = side === "left" || side === "right" ? "row" : "column";
  const before = side === "left" || side === "top";
  const path = pathTo(layout, targetId);
  const parent = path.length > 1 ? findSplit(layout, path.at(-2)!) : undefined;

  if (parent && parent.direction === direction) {
    const i = parent.children.findIndex((c) => c.id === targetId);
    const half = parent.sizes[i]! / 2;
    const children = [...parent.children];
    const sizes = [...parent.sizes];
    sizes[i] = half;
    children.splice(before ? i : i + 1, 0, node);
    sizes.splice(before ? i : i + 1, 0, half);
    return replaceNode(layout, parent.id, { ...parent, children, sizes });
  }

  const target = path.length
    ? (findIsland(layout, targetId) ?? findSplit(layout, targetId))
    : undefined;
  if (!target) return layout;
  return replaceNode(
    layout,
    targetId,
    newSplit(direction, before ? [node, target] : [target, node]),
  );
}

// ─── Normalisation ───────────────────────────────────────────────────────────

/** Normalise a layout tree; returns null if no island with tabs is left. */
export function normalizeLayout(node: LayoutNode): LayoutNode | null {
  if (node.kind === "island") {
    if (!node.tabs.length) return null;
    const ids = new Set(node.tabs.map((t) => t.id));
    const selectedTabId = ids.has(node.selectedTabId) ? node.selectedTabId : node.tabs[0]!.id;
    const pinned = node.pinned.filter((id) => ids.has(id));
    if (selectedTabId === node.selectedTabId && pinned.length === node.pinned.length) return node;
    return { ...node, selectedTabId, pinned };
  }

  const children: LayoutNode[] = [];
  const sizes: number[] = [];
  let changed = node.children.length !== node.sizes.length;
  node.children.forEach((child, i) => {
    const size = node.sizes[i] ?? 1 / node.children.length;
    const n = normalizeLayout(child);
    if (n !== child) changed = true;
    if (!n) return;
    if (n.kind === "split" && n.direction === node.direction) {
      changed = true;
      n.children.forEach((cc, j) => {
        children.push(cc);
        sizes.push(size * n.sizes[j]!);
      });
    } else {
      children.push(n);
      sizes.push(size);
    }
  });

  if (!children.length) return null;
  if (children.length === 1) return children[0]!;
  const total = sizes.reduce((a, b) => a + b, 0);
  if (Math.abs(total - 1) > 1e-9) changed = true;
  if (!changed) return node;
  const even = 1 / children.length;
  return {
    ...node,
    children,
    sizes: total > 0 ? sizes.map((s) => s / total) : children.map(() => even),
  };
}

export function normalizeWorkspace(ws: Workspace): Workspace {
  const layout = normalizeLayout(ws.layout);
  if (!layout) return { ...createWorkspace([HOME_HREF]), closed: ws.closed };
  const all = islands(layout);
  const focusedIslandId = all.some((i) => i.id === ws.focusedIslandId)
    ? ws.focusedIslandId
    : all[0]!.id;
  const ids = new Set(all.map((i) => i.id));
  const focusHistory = [...new Set([focusedIslandId, ...ws.focusHistory, ...ids])].filter((id) =>
    ids.has(id),
  );
  const sameHistory =
    focusHistory.length === ws.focusHistory.length &&
    focusHistory.every((id, i) => id === ws.focusHistory[i]);
  const maximizedIslandId =
    ws.maximizedIslandId &&
    layout.kind === "split" &&
    all.some((i) => i.id === ws.maximizedIslandId)
      ? ws.maximizedIslandId
      : null;
  if (
    layout === ws.layout &&
    focusedIslandId === ws.focusedIslandId &&
    maximizedIslandId === ws.maximizedIslandId &&
    sameHistory
  ) {
    return ws;
  }
  return {
    ...ws,
    layout,
    focusedIslandId,
    maximizedIslandId,
    focusHistory: sameHistory ? ws.focusHistory : focusHistory,
  };
}
