import { create } from "zustand";
import { persist } from "zustand/middleware";

export type NavVariantId =
  | "inline"
  | "inline-wide"
  | "terminal"
  | "split-rail"
  | "command-center"
  | "monoline"
  | "deck"
  | "vertical-rail"
  | "heads-up"
  | "brutalist";

export const NAV_VARIANTS: {
  id: NavVariantId;
  name: string;
  description: string;
}[] = [
  { id: "inline", name: "Inline", description: "Container-width, tabs inline with nav" },
  { id: "inline-wide", name: "Inline wide", description: "Full-bleed edge-to-edge, tabs inline" },
  { id: "terminal", name: "Terminal", description: "Shell prompt with filename tabs" },
  { id: "split-rail", name: "Split rail", description: "Identity up, tabs below" },
  { id: "command-center", name: "Command center", description: "Center search, floating chips" },
  { id: "monoline", name: "Monoline", description: "One thin line, maximum content" },
  { id: "deck", name: "Deck", description: "Full-bleed panorama with vertical rules" },
  { id: "vertical-rail", name: "Vertical rail", description: "Left sidebar, content pushed right" },
  { id: "heads-up", name: "Heads-up", description: "Floating glass island, not edge-to-edge" },
  { id: "brutalist", name: "Brutalist", description: "Oversized wordmark, chunky editorial" },
];

type NavVariantState = {
  variantId: NavVariantId;
  setVariantId: (id: NavVariantId) => void;
};

export const useNavVariantStore = create<NavVariantState>()(
  persist(
    (set) => ({
      variantId: "inline",
      setVariantId: (variantId) => set({ variantId }),
    }),
    { name: "githut.nav-variant.v1" },
  ),
);
