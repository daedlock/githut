/**
 * The tab pane an element scrolls inside (ADR 0001: each tab scrolls in its
 * own container, not the window). Use it as the `root` of IntersectionObservers
 * so margins and clipping are measured against the tab, not the viewport.
 * Null outside a tab, which observers treat as the viewport.
 */
export function tabScrollContainer(el: Element | null): HTMLElement | null {
  return el?.closest<HTMLElement>("[data-tab-pane]") ?? null;
}
