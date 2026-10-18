import { create } from "zustand";
import { trackWorkspaceAction } from "@/app/lib/analytics";
import { useSidebarStore } from "./sidebar";

/** Per-window presentation only. Resize and drawer actions never rewrite the saved layout/sidebar. */
export const useWorkspaceView = create<{
  narrow: boolean;
  sidebarOpen: boolean;
  setNarrow: (narrow: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}>((set, get) => ({
  narrow: typeof window !== "undefined" && window.innerWidth < 720,
  sidebarOpen: false,
  setNarrow: (narrow) =>
    set((state) => (state.narrow === narrow ? state : { narrow, sidebarOpen: false })),
  setSidebarOpen: (sidebarOpen) => {
    if (get().sidebarOpen === sidebarOpen) return;
    set({ sidebarOpen });
    trackWorkspaceAction("sidebar-toggled");
  },
  toggleSidebar: () => {
    if (get().narrow) {
      get().setSidebarOpen(!get().sidebarOpen);
    } else useSidebarStore.getState().toggle();
  },
}));
