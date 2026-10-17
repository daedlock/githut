import { create } from "zustand";

import {
  createWorkspace,
  findIsland,
  focusedTab,
  HOME_HREF,
  islands,
  type LayoutNode,
  runCommand,
  type Tab,
  type Workspace,
  type WorkspaceCommand,
} from "@/app/workspace/model";
import { loadWorkspace, saveWorkspace } from "@/app/workspace/persistence";

// ─── Workspace store ─────────────────────────────────────────────────────────
//
// The window's one workspace. State changes only through `dispatch` with a
// named command (see model.ts); components subscribe with selectors.

type UndoEntry = { id: number; workspace: Workspace; label: string };
type WorkspaceState = {
  workspace: Workspace;
  undo: UndoEntry[];
  notice: UndoEntry | null;
  dockingRevision: number;
};

export const useWorkspaceStore = create<WorkspaceState>()(() => ({
  workspace: createWorkspace([HOME_HREF]),
  undo: [],
  notice: null,
  dockingRevision: 0,
}));

export function getWorkspace(): Workspace {
  return useWorkspaceStore.getState().workspace;
}

let undoId = 0;

export function dispatch(cmd: WorkspaceCommand | { type: "undo" }) {
  if (cmd.type === "undo") {
    undoLayout();
    return;
  }
  const prev = getWorkspace();
  const next = runCommand(prev, cmd);
  if (next === prev) return;
  const label = undoLabel(cmd);
  if (label) {
    const entry = { id: ++undoId, workspace: prev, label };
    const show =
      cmd.type === "closeOtherTabs" ||
      cmd.type === "closeTabsToRight" ||
      (cmd.type === "closeIsland" &&
        (findIsland(prev.layout, cmd.islandId)?.tabs.length ?? 0) > 1) ||
      (cmd.type === "dock" && cmd.source.type === "island" && cmd.target.type === "tabs");
    useWorkspaceStore.setState((s) => ({
      workspace: next,
      undo: [...s.undo, entry].slice(-10),
      notice: show ? entry : null,
      dockingRevision: s.dockingRevision + (cmd.type === "dock" ? 1 : 0),
    }));
  } else {
    useWorkspaceStore.setState({ workspace: next });
  }
}

function undoLabel(cmd: WorkspaceCommand): string | null {
  switch (cmd.type) {
    case "dock":
      return cmd.source.type === "island" && cmd.target.type === "tabs"
        ? "Islands merged"
        : "Layout changed";
    case "closeIsland":
      return "Island closed";
    case "closeOtherTabs":
      return "Other tabs closed";
    case "closeTabsToRight":
      return "Tabs to the right closed";
    case "closeTab":
      return "Tab closed";
    case "splitIsland":
    case "moveTab":
    case "resizeGap":
    case "equalizeSplit":
      return "Layout changed";
    // Opening tabs must also be undoable, so restoring an older layout never
    // silently discards tabs opened since the operation being undone.
    case "openTab":
    case "openUrl":
    case "duplicateTab":
    case "reopenClosedTab":
      return "Tab opened";
    default:
      return null;
  }
}

export function undoLayout() {
  const state = useWorkspaceStore.getState();
  const entry = state.undo.at(-1);
  if (!entry) return;
  // Layout undo must not rewind navigation in a surviving tab.
  const live = new Map(
    islands(state.workspace.layout).flatMap((i) => i.tabs.map((t) => [t.id, t] as const)),
  );
  const restore = (node: LayoutNode): LayoutNode =>
    node.kind === "island"
      ? { ...node, tabs: node.tabs.map((tab) => live.get(tab.id) ?? tab) }
      : { ...node, children: node.children.map(restore) };
  useWorkspaceStore.setState({
    workspace: { ...entry.workspace, layout: restore(entry.workspace.layout) },
    undo: state.undo.slice(0, -1),
    notice: null,
    dockingRevision: state.dockingRevision + 1,
  });
}

export function dismissLayoutNotice() {
  useWorkspaceStore.setState({ notice: null });
}

/** The focused tab right now (GLOSSARY → Focused island). */
export function getFocusedTab(): Tab {
  return focusedTab(getWorkspace());
}

export function useFocusedTab(): Tab {
  return useWorkspaceStore((s) => focusedTab(s.workspace));
}

/**
 * Load this window's saved layout and keep it saved. The window that changes
 * its layout, or comes back to the front, becomes the last-used one.
 */
export function initWorkspace(href: string): () => void {
  useWorkspaceStore.setState({ workspace: loadWorkspace(href), undo: [], notice: null });
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
