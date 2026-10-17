import { create } from "zustand";

import {
  createWorkspace,
  focusedTab,
  HOME_HREF,
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

type WorkspaceState = { workspace: Workspace };

export const useWorkspaceStore = create<WorkspaceState>()(() => ({
  workspace: createWorkspace([HOME_HREF]),
}));

export function getWorkspace(): Workspace {
  return useWorkspaceStore.getState().workspace;
}

export function dispatch(cmd: WorkspaceCommand) {
  const prev = getWorkspace();
  const next = runCommand(prev, cmd);
  if (next !== prev) useWorkspaceStore.setState({ workspace: next });
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
  useWorkspaceStore.setState({ workspace: loadWorkspace(href) });
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
