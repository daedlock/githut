export const IS_MAC =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/i.test(navigator.platform);

/** Render a shortcut token for this platform: ⌘ reads "Ctrl" off macOS, ⌥ reads "Alt". */
export function platformKey(token: string) {
  if (IS_MAC) return token;
  if (token === "⌘") return "Ctrl";
  if (token === "⌥") return "Alt";
  return token;
}
