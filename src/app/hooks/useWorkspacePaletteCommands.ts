import { Columns2, PanelLeft } from "lucide-react";
import { useMemo } from "react";
import { focusPaneOfFocusedTab } from "@/app/lib/tabActions";
import { useSidebarStore } from "@/app/stores/sidebar";
import { useWorkspaceView } from "@/app/stores/workspaceView";
import { buildWorkspaceCommands } from "@/app/workspace/palette";
import { dispatch, getWorkspace, useWorkspaceStore } from "@/app/workspace/store";

/** Adapts named layout commands to the palette, resolving current geometry on execution. */
export function useWorkspacePaletteCommands(open: boolean, close: () => void) {
  const workspace = useWorkspaceStore((s) => s.workspace);
  const canUndo = useWorkspaceStore((s) => s.undo.length > 0);
  return useMemo(() => {
    if (!open) return [];
    const size = () => {
      const element = document.querySelector<HTMLElement>("[data-workspace-layout]");
      return { width: element?.clientWidth ?? 0, height: element?.clientHeight ?? 0 };
    };
    return [
      ...buildWorkspaceCommands(workspace, size(), canUndo).map((entry) => ({
        ...entry,
        icon: Columns2,
        workspace: true,
        run: () => {
          // The browser may have resized while the palette was open. Resolve
          // the same command again so gap extents and destinations are current.
          const current = buildWorkspaceCommands(
            getWorkspace(),
            size(),
            useWorkspaceStore.getState().undo.length > 0,
          ).find((item) => item.id === entry.id);
          close();
          if (current && !current.disabled) {
            dispatch(current.command);
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
  }, [workspace, canUndo, close, open]);
}
