import { useCallback, useEffect, useMemo } from "react";
import { useKeybindings } from "@/app/hooks/useKeybindings";

const LIST_ITEM_SELECTOR = "[data-keyboard-list-item]";

/** The row last opened from each list page, so coming back lands on it. */
const lastOpened = new Map<string, string>();

export function getNextListIndex(current: number, length: number, direction: 1 | -1): number {
  if (length === 0) return -1;
  if (current < 0) return direction === 1 ? 0 : length - 1;
  return Math.min(length - 1, Math.max(0, current + direction));
}

function visibleItems() {
  return Array.from(document.querySelectorAll<HTMLElement>(LIST_ITEM_SELECTOR)).filter(
    (item) => item.getClientRects().length > 0,
  );
}

function focusItem(item: HTMLElement | undefined) {
  item?.focus({ preventScroll: true });
  item?.scrollIntoView({ block: "nearest" });
}

/**
 * Keyboard navigation for list pages, like a native list: j/k (and the arrow
 * keys while a row has focus) move between rows, and returning from a detail
 * page puts focus back on the row you opened.
 */
export function useListNavigation(enabled = true): void {
  const moveFocus = useCallback(
    (direction: 1 | -1) => {
      if (!enabled) return;
      const items = visibleItems();
      const activeItem =
        document.activeElement instanceof HTMLElement
          ? document.activeElement.closest<HTMLElement>(LIST_ITEM_SELECTOR)
          : null;
      const current = activeItem ? items.indexOf(activeItem) : -1;
      focusItem(items[getNextListIndex(current, items.length, direction)]);
    },
    [enabled],
  );

  const shortcuts = useMemo(
    () => ({
      j: () => moveFocus(1),
      k: () => moveFocus(-1),
    }),
    [moveFocus],
  );

  useKeybindings(shortcuts);

  // Arrow keys belong to the page (scrolling) unless a row has focus.
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const target = event.target;
      if (!(target instanceof HTMLElement) || !target.matches(LIST_ITEM_SELECTOR)) return;
      event.preventDefault();
      moveFocus(event.key === "ArrowDown" ? 1 : -1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, moveFocus]);

  // Remember which row was opened, and refocus it when the list comes back.
  useEffect(() => {
    if (!enabled) return;
    const page = window.location.pathname;
    const remembered = lastOpened.get(page);
    if (remembered) {
      const row = visibleItems().find(
        (item) => item instanceof HTMLAnchorElement && item.getAttribute("href") === remembered,
      );
      if (row && !document.activeElement?.closest("input, textarea, [role=dialog]")) focusItem(row);
    }
    const onClick = (event: MouseEvent) => {
      const link = (event.target as HTMLElement | null)?.closest<HTMLAnchorElement>(
        `a${LIST_ITEM_SELECTOR}`,
      );
      const href = link?.getAttribute("href");
      if (href) lastOpened.set(page, href);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [enabled]);
}
