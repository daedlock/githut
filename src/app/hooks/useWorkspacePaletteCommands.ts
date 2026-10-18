import { Columns2, PanelLeft } from "lucide-react";
import { useMemo } from "react";
import { focusPaneOfFocusedTab } from "@/app/lib/tabActions";
import { useSidebarStore } from "@/app/stores/sidebar";
import { useWorkspaceView } from "@/app/stores/workspaceView";
import type { Workspace } from "@/app/workspace/model";
import { buildWorkspaceCommands, runWorkspacePaletteCommand } from "@/app/workspace/palette";
import { previewCommand, useWorkspaceStore } from "@/app/workspace/store";

/** The palette's layout commands, built against a workspace and the current room. */
function commandsFor(workspace: Workspace, canUndo: boolean, canRedo: boolean) {
  return buildWorkspaceCommands(workspace, {
    canUndo,
    canRedo,
    allowed: (cmd) => previewCommand(cmd) !== null,
  });
}

function currentCommands() {
  const { workspace, undo, redo } = useWorkspaceStore.getState();
  return commandsFor(workspace, undo.length > 0, redo.length > 0);
}

/** Adapts named layout commands to the palette, resolving them again on execution. */
export function useWorkspacePaletteCommands(open: boolean, close: () => void) {
  const workspace = useWorkspaceStore((s) => s.workspace);
  const canUndo = useWorkspaceStore((s) => s.undo.length > 0);
  const canRedo = useWorkspaceStore((s) => s.redo.length > 0);
  return useMemo(() => {
    if (!open) return [];
    return [
      ...commandsFor(workspace, canUndo, canRedo).map((entry) => ({
        ...entry,
        icon: Columns2,
        workspace: true,
        run: () => {
          // The workspace may have changed while the palette was open.
          // Resolve the same entry again so its targets are current.
          const current = currentCommands().find((item) => item.id === entry.id);
          close();
          if (current && !current.disabled) {
            runWorkspacePaletteCommand(current.command);
            focusPaneOfFocusedTab();
          }
        },
      })),
      {
        id: "layout:sidebar",
        label: "Toggle sidebar",
        icon: PanelLeft,
        keywords: ["layout", "drawer", "show", "hide", "collapse"],
        shortcut: "⌘ B",
        workspace: true,
        run: () => {
          close();
          useWorkspaceView.getState().toggleSidebar();
        },
      },
      {
        id: "layout:sidebar-reset",
        label: "Reset sidebar width",
        icon: PanelLeft,
        keywords: ["layout", "resize", "default"],
        workspace: true,
        run: () => {
          close();
          useSidebarStore.getState().reset();
        },
      },
      ...([-16, 16] as const).map((delta) => ({
        id: `layout:sidebar-width:${delta}`,
        label: `Make sidebar ${delta < 0 ? "narrower" : "wider"}`,
        icon: PanelLeft,
        keywords: ["layout", "resize", "width"],
        workspace: true,
        run: () => {
          close();
          const sidebar = useSidebarStore.getState();
          sidebar.resize(sidebar.width + delta);
        },
      })),
    ];
  }, [workspace, canUndo, canRedo, close, open]);
}
