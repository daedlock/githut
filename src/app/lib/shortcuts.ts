export type ShortcutMap = Record<string, () => void>;

/** Whether the primary modifier (`⌘` in chords) is Command rather than Ctrl. */
export const IS_MAC =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
/** The primary modifier's label for shortcut hints: ⌘ on Apple platforms, Ctrl elsewhere. */
export const MOD_KEY = IS_MAC ? "⌘" : "Ctrl";

// Stubs until their actions exist. Consumers (P1.T1.b, P1.T1.c, etc.) replace
// the handlers at runtime or merge their own map into useKeybindings.
// P1.T1.b note: ⌘k is composed at the CommandPalette component level
// (useKeybindings there, toggling the zustand store) — keeping this registry
// entry as a no-op is intentional so downstream consumers that want to merge
// GLOBAL_SHORTCUTS don't double-fire the handler.
// TODO(P1.T1.c): wire ? → keyboard help overlay
// TODO(P2.T2.a): wire g h → home/inbox route
// TODO(P3.T3.a): wire g p → pulls route (scoped to current repo)
// TODO(P3.T3.a): wire g i → issues route (scoped to current repo)
// TODO(Code tab): wire g c → code route (scoped to current repo)
export const GLOBAL_SHORTCUTS: ShortcutMap = {
  "⌘k": () => {},
  "?": () => {},
  "g h": () => {},
  "g i": () => {},
  "g p": () => {},
  "g c": () => {},
};
