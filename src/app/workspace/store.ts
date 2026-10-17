import { create } from "zustand";
import { trackWorkspaceAction } from "@/app/lib/analytics";
import { retireTabHint } from "@/app/stores/tabHint";

import {
  createWorkspace,
  findIsland,
  findTab,
  focusedTab,
  HOME_HREF,
  type Island,
  islands,
  type LayoutNode,
  normalizeWorkspace,
  replaceNode,
  runCommand,
  type Tab,
  type Workspace,
  type WorkspaceCommand,
} from "@/app/workspace/model";
import { loadWorkspace, saveWorkspace } from "@/app/workspace/persistence";
import { fitLayout, layoutFits, type Space } from "@/app/workspace/view";

// ─── Workspace store ─────────────────────────────────────────────────────────
//
// The window's one workspace. State changes only through `dispatch` with a
// named command (see model.ts); components subscribe with selectors.
//
// Undo covers destructive layout changes only: closing other tabs or the
// tabs to the right, closing an island with several tabs, merging, moving or
// docking tabs and islands, and resetting the layout. Opening, selecting and
// navigating are never recorded, so ⌘Z can't rewind them.

type UndoEntry = {
  id: number;
  label: string;
  command: WorkspaceCommand;
  /** The workspace before the command ran. */
  workspace: Workspace;
  /** Tabs the command closed; undo brings back only these. */
  removed: string[];
};
/** A short message shown in a toast, optionally offering undo of the latest entry. */
export type LayoutNotice = { id: number; label: string; undoable: boolean };
type WorkspaceState = {
  workspace: Workspace;
  undo: UndoEntry[];
  redo: UndoEntry[];
  notice: LayoutNotice | null;
  dockingRevision: number;
};

const MAX_UNDO = 10;

export const useWorkspaceStore = create<WorkspaceState>()(() => ({
  workspace: createWorkspace([HOME_HREF]),
  undo: [],
  redo: [],
  notice: null,
  dockingRevision: 0,
}));

export function getWorkspace(): Workspace {
  return useWorkspaceStore.getState().workspace;
}

let entryId = 0;

// ─── Room for islands ────────────────────────────────────────────────────────

let measureSpace: () => Space | null = () => null;

/**
 * Tell the store how much room the islands have right now (null while the
 * workspace is in narrow mode or not on screen). Commands that create or
 * resize islands are then fitted to the minimum island size, or refused.
 */
export function setWorkspaceSpace(measure: () => Space | null) {
  measureSpace = measure;
}

/** Commands that can shrink an island below its minimum. */
const FITTED = new Set<WorkspaceCommand["type"]>([
  "dock",
  "splitIsland",
  "openToSide",
  "equalizeSplit",
]);

/**
 * `next` with split sizes shifted so every island keeps its minimum size, or
 * null when there isn't room. A layout that already doesn't fit (the window
 * shrank into narrow mode) is not held to the minimums.
 */
function fitToSpace(prev: Workspace, next: Workspace, cmd: WorkspaceCommand): Workspace | null {
  if (!FITTED.has(cmd.type)) return next;
  const space = measureSpace();
  if (!space || !layoutFits(prev.layout, space)) return next;
  const layout = fitLayout(next.layout, space);
  if (!layoutFits(layout, space)) return null;
  return layout === next.layout ? next : { ...next, layout };
}

/**
 * The workspace a command would produce, exactly as `dispatch` would commit
 * it, or null if it would change nothing or there is no room for it. Drop
 * previews and menus use this to show the real result.
 */
export function previewCommand(cmd: WorkspaceCommand): Workspace | null {
  const prev = getWorkspace();
  const next = runCommand(prev, cmd);
  return next === prev ? null : fitToSpace(prev, next, cmd);
}

// ─── Commands ────────────────────────────────────────────────────────────────

export function dispatch(cmd: WorkspaceCommand) {
  const prev = getWorkspace();
  const ran = runCommand(prev, cmd);
  if (ran === prev) return;
  const next = fitToSpace(prev, ran, cmd);
  if (!next) {
    // No room for another island: open the page as a tab instead.
    if (cmd.type === "openToSide") {
      dispatch({ type: "openTab", href: cmd.href, islandId: cmd.islandId });
      showNotice("No room for another island, so it opened as a tab");
    } else showNotice("Not enough room for another island");
    return;
  }
  commit(prev, next, cmd, { clearRedo: true });
}

function commit(
  prev: Workspace,
  next: Workspace,
  cmd: WorkspaceCommand,
  { clearRedo }: { clearRedo: boolean },
) {
  const label = undoLabel(prev, cmd);
  const docked = cmd.type === "dock" ? 1 : 0;
  if (label) {
    const entry: UndoEntry = {
      id: ++entryId,
      label,
      command: cmd,
      workspace: prev,
      removed: [...tabIds(prev.layout)].filter((id) => !tabIds(next.layout).has(id)),
    };
    useWorkspaceStore.setState((s) => ({
      workspace: next,
      undo: [...s.undo, entry].slice(-MAX_UNDO),
      redo: clearRedo ? [] : s.redo,
      notice: toastFor(prev, cmd) ? { id: entry.id, label, undoable: true } : s.notice,
      dockingRevision: s.dockingRevision + docked,
    }));
  } else {
    // Redo replays a command on the current layout, so it goes stale once
    // tabs or islands come or go.
    const stale = clearRedo && !sameShape(prev.layout, next.layout);
    useWorkspaceStore.setState((s) => ({
      workspace: next,
      redo: stale ? [] : s.redo,
      dockingRevision: s.dockingRevision + docked,
    }));
  }
  if (islands(next.layout).length > islands(prev.layout).length) {
    retireTabHint();
    trackWorkspaceAction("split");
  }
  if (cmd.type === "dock" && cmd.source.type === "island") trackWorkspaceAction("move-island");
  if (cmd.type === "pinTab" && cmd.pinned) trackWorkspaceAction("pin");
}

/** The undo label for a destructive layout change; null for anything else. */
function undoLabel(prev: Workspace, cmd: WorkspaceCommand): string | null {
  switch (cmd.type) {
    case "resetLayout":
      return "Layout reset";
    case "closeOtherTabs":
      return "Other tabs closed";
    case "closeTabsToRight":
      return "Tabs to the right closed";
    case "closeIsland":
      return (findIsland(prev.layout, cmd.islandId)?.tabs.length ?? 0) > 1 ? "Island closed" : null;
    case "dock": {
      if (cmd.source.type === "href") return null;
      if (cmd.source.type === "island")
        return cmd.target.type === "tabs" ? "Islands merged" : "Island moved";
      // Reordering a tab within its own strip isn't destructive.
      const from = findTab(prev.layout, cmd.source.tabId)?.island.id;
      return cmd.target.type === "tabs" && cmd.target.islandId === from ? null : "Tab moved";
    }
    default:
      return null;
  }
}

/** Changes that lose several tabs or an island announce themselves with an undo toast. */
function toastFor(prev: Workspace, cmd: WorkspaceCommand): boolean {
  return (
    cmd.type === "resetLayout" ||
    cmd.type === "closeOtherTabs" ||
    cmd.type === "closeTabsToRight" ||
    cmd.type === "closeIsland" ||
    (cmd.type === "dock" &&
      cmd.source.type === "island" &&
      cmd.target.type === "tabs" &&
      !!findIsland(prev.layout, cmd.source.islandId))
  );
}

function showNotice(label: string) {
  useWorkspaceStore.setState({ notice: { id: ++entryId, label, undoable: false } });
}

export function dismissLayoutNotice() {
  useWorkspaceStore.setState({ notice: null });
}

// ─── Undo / redo ─────────────────────────────────────────────────────────────

/**
 * Restore the layout from before the latest destructive change. Tabs keep
 * where they navigated since; tabs opened since stay open (in their island,
 * or the restored focused island if theirs is gone); tabs closed since stay
 * closed. Closed tabs come back from their href with fresh routers.
 */
export function undoLayout() {
  const state = useWorkspaceStore.getState();
  const entry = state.undo.at(-1);
  if (!entry) return;
  useWorkspaceStore.setState({
    workspace: restore(entry, state.workspace),
    undo: state.undo.slice(0, -1),
    redo: [...state.redo, entry].slice(-MAX_UNDO),
    notice: null,
    dockingRevision: state.dockingRevision + 1,
  });
}

/** Run the most recently undone change again. */
export function redoLayout() {
  const state = useWorkspaceStore.getState();
  const entry = state.redo.at(-1);
  if (!entry) return;
  useWorkspaceStore.setState({ redo: state.redo.slice(0, -1), notice: null });
  const prev = getWorkspace();
  const ran = runCommand(prev, entry.command);
  const next = ran === prev ? null : fitToSpace(prev, ran, entry.command);
  if (next) commit(prev, next, entry.command, { clearRedo: false });
}

function restore(entry: UndoEntry, current: Workspace): Workspace {
  const live = new Map<string, { tab: Tab; island: Island }>();
  for (const island of islands(current.layout))
    for (const tab of island.tabs) live.set(tab.id, { tab, island });
  const removed = new Set(entry.removed);
  const before = tabIds(entry.workspace.layout);

  const rebuild = (node: LayoutNode): LayoutNode =>
    node.kind === "island"
      ? {
          ...node,
          tabs: node.tabs
            .filter((tab) => live.has(tab.id) || removed.has(tab.id))
            .map((tab) => live.get(tab.id)?.tab ?? tab),
        }
      : { ...node, children: node.children.map(rebuild) };
  let layout = rebuild(entry.workspace.layout);

  for (const { tab, island } of live.values()) {
    if (before.has(tab.id)) continue;
    const home =
      findIsland(layout, island.id) ??
      findIsland(layout, entry.workspace.focusedIslandId) ??
      islands(layout)[0]!;
    const pinned = island.pinned.includes(tab.id) ? [...home.pinned, tab.id] : home.pinned;
    layout = replaceNode(layout, home.id, { ...home, tabs: [...home.tabs, tab], pinned });
  }

  // Forget the reopen entries the undone close added.
  const closed = [...current.closed];
  for (const id of entry.removed) {
    const href = findTab(entry.workspace.layout, id)?.tab.href;
    const at = href ? closed.lastIndexOf(href) : -1;
    if (at >= 0) closed.splice(at, 1);
  }
  return normalizeWorkspace({ ...entry.workspace, layout, closed });
}

function tabIds(layout: LayoutNode): Set<string> {
  return new Set(islands(layout).flatMap((island) => island.tabs.map((tab) => tab.id)));
}

/** Same islands holding the same tabs, regardless of order, selection or hrefs. */
function sameShape(a: LayoutNode, b: LayoutNode): boolean {
  const shape = (layout: LayoutNode) =>
    islands(layout)
      .map((island) => `${island.id}:${island.tabs.map((tab) => tab.id).sort()}`)
      .sort()
      .join("|");
  return a === b || shape(a) === shape(b);
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/** The focused tab right now (GLOSSARY → Focused island). */
export function getFocusedTab(): Tab {
  return focusedTab(getWorkspace());
}

export function useFocusedTab(): Tab {
  return useWorkspaceStore((s) => focusedTab(s.workspace));
}

// ─── Persistence ─────────────────────────────────────────────────────────────

/**
 * Load this window's saved layout and keep it saved. The window that changes
 * its layout, or comes back to the front, becomes the last-used one.
 */
export function initWorkspace(href: string): () => void {
  useWorkspaceStore.setState({
    workspace: loadWorkspace(href),
    undo: [],
    redo: [],
    notice: null,
  });
  if (islands(getWorkspace().layout).length > 1) retireTabHint();
  saveWorkspace(getWorkspace());

  const unsubscribe = useWorkspaceStore.subscribe((s, prev) => {
    if (
      s.workspace.layout !== prev.workspace.layout ||
      s.workspace.focusedIslandId !== prev.workspace.focusedIslandId ||
      s.workspace.maximizedIslandId !== prev.workspace.maximizedIslandId
    ) {
      saveWorkspace(s.workspace);
    }
  });
  const onFront = () => {
    if (document.visibilityState === "visible") saveWorkspace(getWorkspace());
  };
  window.addEventListener("focus", onFront);
  document.addEventListener("visibilitychange", onFront);
  return () => {
    unsubscribe();
    window.removeEventListener("focus", onFront);
    document.removeEventListener("visibilitychange", onFront);
  };
}
