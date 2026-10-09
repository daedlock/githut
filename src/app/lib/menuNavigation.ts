import type { KeyboardEvent } from "react";

const NEXT = new Set(["n", "j"]);
const PREVIOUS = new Set(["p", "k"]);

/**
 * Ctrl+N / Ctrl+J move down and Ctrl+P / Ctrl+K move up, as in cmdk and most
 * desktop tools. Radix menus only understand arrow keys, so translate the
 * chord into the arrow key on whatever has focus and let Radix do the rest.
 * Compose into a menu content's `onKeyDown`.
 */
export function handleMenuNavigationKey(event: KeyboardEvent<HTMLElement>) {
  if (!event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
  const key = event.key.toLowerCase();
  const arrow = NEXT.has(key) ? "ArrowDown" : PREVIOUS.has(key) ? "ArrowUp" : null;
  if (!arrow) return;
  event.preventDefault();
  event.target.dispatchEvent(
    new globalThis.KeyboardEvent("keydown", { key: arrow, bubbles: true, cancelable: true }),
  );
}
