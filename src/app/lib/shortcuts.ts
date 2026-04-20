export type ShortcutMap = Record<string, () => void>;

// Stubs until their actions exist. Consumers (P1.T1.b, P1.T1.c, etc.) replace
// the handlers at runtime or merge their own map into useKeybindings.
// TODO(P1.T1.b): wire ⌘k → command palette open
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
