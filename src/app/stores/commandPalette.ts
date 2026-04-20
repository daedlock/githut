import { create } from "zustand";

/**
 * Command palette open/close state — ephemeral (not persisted).
 *
 * This is the UI-state side of the command palette per the architecture memo:
 * a tiny Zustand store for cross-cutting client UI that plain `useState`
 * can't carry across unrelated subtrees (keyboard shortcuts, top-bar triggers,
 * and the palette component itself all need to poke the same on/off switch).
 *
 * Deliberately minimal. P1.G2 scope ends here — content (items, query,
 * selected index, peek promotion) is built in P1.T1.b and may extend this
 * file with more state at that time.
 */
type CommandPaletteState = {
  open: boolean;
  setOpen: (open: boolean) => void;
  openPalette: () => void;
  closePalette: () => void;
  toggle: () => void;
};

export const useCommandPaletteStore = create<CommandPaletteState>()((set, get) => ({
  open: false,
  setOpen: (open) => set({ open }),
  openPalette: () => set({ open: true }),
  closePalette: () => set({ open: false }),
  toggle: () => set({ open: !get().open }),
}));

/**
 * Convenience hook for callers that only need to trigger open/close/toggle
 * without subscribing to the `open` state (and paying a re-render on every
 * flip). Returns stable function references pulled off the store.
 *
 * Use this from the top-bar button, keyboard shortcuts, and anywhere else
 * that imperatively controls the palette. Callers that actually need to
 * render based on `open` (i.e. the palette itself) should subscribe to
 * `useCommandPaletteStore` directly.
 */
export function useCommandPalette() {
  return {
    open: useCommandPaletteStore((s) => s.openPalette),
    close: useCommandPaletteStore((s) => s.closePalette),
    toggle: useCommandPaletteStore((s) => s.toggle),
  };
}
