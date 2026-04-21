import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ProfileLayoutId = "classic" | "dossier" | "editorial" | "grid";

export const PROFILE_LAYOUTS: {
  id: ProfileLayoutId;
  name: string;
  description: string;
}[] = [
  { id: "classic", name: "Classic", description: "Sidebar + README-first main column" },
  { id: "dossier", name: "Dossier", description: "Personnel file — mono left rail, inventory below" },
  { id: "editorial", name: "Editorial", description: "Magazine spread — hero + long-form reading" },
  { id: "grid", name: "Grid", description: "Bento dashboard — everything at a glance" },
];

type ProfileLayoutState = {
  layoutId: ProfileLayoutId;
  setLayoutId: (id: ProfileLayoutId) => void;
};

export const useProfileLayoutStore = create<ProfileLayoutState>()(
  persist(
    (set) => ({
      layoutId: "classic",
      setLayoutId: (layoutId) => set({ layoutId }),
    }),
    { name: "githut.profile-layout.v1" },
  ),
);
