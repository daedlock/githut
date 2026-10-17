import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { trackWorkspaceAction } from "@/app/lib/analytics";

export const SIDEBAR_DEFAULT_WIDTH = 240;
export const SIDEBAR_RAIL_WIDTH = 40;

type SidebarState = {
  width: number;
  collapsed: boolean;
  toggle: () => void;
  resize: (width: number) => void;
  expand: () => void;
  reset: () => void;
};

export const createSidebarStore = (storage?: StateStorage) =>
  create<SidebarState>()(
    persist(
      (set) => ({
        width: SIDEBAR_DEFAULT_WIDTH,
        collapsed: false,
        toggle: () => {
          set((state) => ({ collapsed: !state.collapsed }));
          trackWorkspaceAction("sidebar-toggled");
        },
        resize: (width) => {
          if (!Number.isFinite(width)) return;
          set(
            width < 140
              ? { collapsed: true }
              : { collapsed: false, width: Math.max(200, Math.min(360, width)) },
          );
        },
        expand: () => set({ collapsed: false }),
        reset: () => set({ collapsed: false, width: SIDEBAR_DEFAULT_WIDTH }),
      }),
      {
        name: "githut.sidebar.v1",
        storage: createJSONStorage(() => storage ?? localStorage),
        partialize: ({ width, collapsed }) => ({ width, collapsed }),
        merge: (persisted, current) => {
          const saved = persisted as Partial<SidebarState> | undefined;
          return {
            ...current,
            collapsed: saved?.collapsed === true,
            width:
              typeof saved?.width === "number" && Number.isFinite(saved.width)
                ? Math.max(200, Math.min(360, saved.width))
                : SIDEBAR_DEFAULT_WIDTH,
          };
        },
      },
    ),
  );

export const useSidebarStore = createSidebarStore();
