import { useCallback, useMemo } from "react";
import { useKeybindings } from "@/app/hooks/useKeybindings";
import { tabPaneRoot, useTabScope } from "@/app/lib/tabScope";

const LIST_ITEM_SELECTOR = "[data-keyboard-list-item]";

export function getNextListIndex(current: number, length: number, direction: 1 | -1): number {
  if (length === 0) return -1;
  if (current < 0) return direction === 1 ? 0 : length - 1;
  return Math.min(length - 1, Math.max(0, current + direction));
}

export function useListNavigation(enabled = true): void {
  const scope = useTabScope();
  const moveFocus = useCallback(
    (direction: 1 | -1) => {
      if (!enabled) return;

      // Only this page's rows: other islands show lists of their own.
      const items = Array.from(
        tabPaneRoot(scope).querySelectorAll<HTMLElement>(LIST_ITEM_SELECTOR),
      ).filter((item) => item.getClientRects().length > 0);
      const activeItem =
        document.activeElement instanceof HTMLElement
          ? document.activeElement.closest<HTMLElement>(LIST_ITEM_SELECTOR)
          : null;
      const current = activeItem ? items.indexOf(activeItem) : -1;
      const next = items[getNextListIndex(current, items.length, direction)];

      next?.focus({ preventScroll: true });
      next?.scrollIntoView({ block: "nearest" });
    },
    [enabled, scope],
  );

  const shortcuts = useMemo(
    () => ({
      j: () => moveFocus(1),
      k: () => moveFocus(-1),
    }),
    [moveFocus],
  );

  useKeybindings(shortcuts);
}
