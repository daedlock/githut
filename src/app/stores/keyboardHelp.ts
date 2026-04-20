import { create } from "zustand";

/**
 * Keyboard-help overlay open/close — ephemeral, mirrors `commandPalette`.
 *
 * Kept as its own tiny store (not folded into the palette) so the two
 * surfaces can open independently and neither re-renders when the other
 * toggles. Same layering rule as the palette: UI-state only; no server data.
 */
type KeyboardHelpState = {
  open: boolean;
  setOpen: (open: boolean) => void;
  openHelp: () => void;
  closeHelp: () => void;
  toggle: () => void;
};

export const useKeyboardHelpStore = create<KeyboardHelpState>()((set, get) => ({
  open: false,
  setOpen: (open) => set({ open }),
  openHelp: () => set({ open: true }),
  closeHelp: () => set({ open: false }),
  toggle: () => set({ open: !get().open }),
}));

export function useKeyboardHelp() {
  return {
    open: useKeyboardHelpStore((s) => s.openHelp),
    close: useKeyboardHelpStore((s) => s.closeHelp),
    toggle: useKeyboardHelpStore((s) => s.toggle),
  };
}
