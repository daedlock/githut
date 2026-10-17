import {
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { createPortal, flushSync } from "react-dom";
import { create } from "zustand";
import { trackWorkspaceAction } from "@/app/lib/analytics";
import { cn } from "@/app/lib/cn";
import { getTabMeta } from "@/app/lib/tabMeta";
import { useWorkspaceView } from "@/app/stores/workspaceView";
import { layoutGeometry, type Rect } from "@/app/workspace/geometry";
import type { DockSource, DockTarget } from "@/app/workspace/model";
import { findIsland, findTab, hrefPathname, selectedTab } from "@/app/workspace/model";
import { dispatch, getWorkspace, previewCommand } from "@/app/workspace/store";

type Drop = { target: DockTarget; rect: Rect; line: boolean; label?: string };

/** Share of an island's width/height, from each edge, that splits instead of moving. */
const EDGE_ZONE = 0.28;

function dropLabel(source: DockSource, target: DockTarget): string | undefined {
  if (target.type === "island-edge")
    return {
      left: "Split left",
      right: "Split right",
      top: "Split up",
      bottom: "Split down",
    }[target.side];
  if (target.type === "workspace-edge")
    return {
      left: "Dock at window left",
      right: "Dock at window right",
      bottom: "Dock at window bottom",
    }[target.side];
  return source.type === "island"
    ? "Merge tabs"
    : source.type === "href"
      ? "Open here"
      : "Move here";
}
type Drag = {
  source: DockSource;
  x: number;
  y: number;
  label: string;
  drop: Drop | null;
  /** A tab drags a copy of itself; other sources show the label pill. */
  lifted: boolean;
};

/**
 * Per-frame drag state lives outside React state of the workspace so only the
 * overlay re-renders while the pointer moves — not the sidebar or the islands.
 */
const useDragStore = create<{ drag: Drag | null }>(() => ({ drag: null }));
const setDrag = (drag: Drag | null) => useDragStore.setState({ drag });

/** One pointer interaction spans every island; the layout changes only on drop. */
export function useDocking(
  ref: RefObject<HTMLDivElement | null>,
  { onDragStart }: { onDragStart?: () => void } = {},
) {
  const cleanup = useRef<(() => void) | null>(null);
  const onDragStartRef = useRef(onDragStart);
  onDragStartRef.current = onDragStart;
  useEffect(() => () => cleanup.current?.(), []);

  /** Adapters can start the same interaction without depending on island-header markup. */
  const beginDrag = useCallback(
    (e: ReactPointerEvent, source: DockSource, label: string) => {
      if (e.button !== 0 || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const root = ref.current;
      if (!root) return;
      cleanup.current?.();
      const start = { x: e.clientX, y: e.clientY };
      let active = false;
      let current: Drag | null = null;
      let frame = 0;
      // The dragged element stays in place, dimmed; a copy of a tab follows
      // the pointer, held where it was grabbed.
      const origin =
        source.type === "tab"
          ? root.querySelector<HTMLElement>(`[data-tab-id="${CSS.escape(source.tabId)}"]`)
          : source.type === "island"
            ? root.querySelector<HTMLElement>(`[data-island="${CSS.escape(source.islandId)}"]`)
            : null;
      let lifted: { el: HTMLElement; dx: number; dy: number } | null = null;
      let sorter: ReturnType<typeof createSorter> | null = null;
      let point = start;
      const previousCursor = document.documentElement.style.cursor;
      const previousSelection = document.documentElement.style.userSelect;

      const update = () => {
        frame = 0;
        if (!active) return;
        stripScroll.active = false;
        current = {
          source,
          ...point,
          label,
          lifted: !!lifted,
          drop: findDrop(root, source, point.x, point.y),
        };
        const target = current.drop?.target;
        if (lifted) {
          const { el } = lifted;
          let x = Math.min(point.x - lifted.dx, window.innerWidth - el.offsetWidth);
          let y = point.y - lifted.dy;
          // Over a strip the tab rides along it, level with its neighbours;
          // anywhere else it follows the pointer freely.
          const home = origin?.closest<HTMLElement>("[data-tab-strip]");
          const overHome = home && within(home.getBoundingClientRect(), point);
          // Over its own strip with no move yet (a no-op target), it rides too.
          const strip =
            target?.type === "tabs" ? stripOf(root, target.islandId) : overHome ? home : null;
          if (strip) {
            const r = strip.getBoundingClientRect();
            x = Math.max(r.left, Math.min(x, r.right - el.offsetWidth));
            y = r.bottom - el.offsetHeight - (origin ? stripInset(origin) : 0);
          }
          el.style.transform = `translate(${x}px, ${y}px)`;
          // Riding its own strip without a move yet: the gap stays at home.
          const islandId = origin?.closest<HTMLElement>("[data-island]")?.dataset.island;
          const index = home ? [...home.querySelectorAll("[data-tab-id]")].indexOf(origin!) : -1;
          sorter?.show(
            target?.type !== "tabs" && overHome && islandId
              ? { type: "tabs", islandId, index }
              : target,
          );
        }
        // Holding still at a strip end keeps scrolling it, not only on move.
        if (stripScroll.active) frame = requestAnimationFrame(update);
        setDrag(current);
      };
      const move = (event: globalThis.PointerEvent) => {
        if (event.pointerId !== e.pointerId) return;
        point = { x: event.clientX, y: event.clientY };
        if (!active && Math.hypot(point.x - start.x, point.y - start.y) < 5) return;
        if (!active) {
          active = true;
          root.setPointerCapture(e.pointerId);
          onDragStartRef.current?.();
          document.documentElement.style.cursor = "grabbing";
          document.documentElement.style.userSelect = "none";
          origin?.setAttribute("data-drag-source", "");
          if (source.type === "tab" && origin) {
            lifted = liftCopy(origin, start);
            sorter = createSorter(root, origin);
          }
        }
        event.preventDefault();
        if (!frame) frame = requestAnimationFrame(update);
      };
      const finish = (commit: boolean, buttonStillDown = false) => {
        if (frame) cancelAnimationFrame(frame);
        if (active && commit) update();
        // The final update may have queued another strip-scroll frame.
        if (frame) cancelAnimationFrame(frame);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", cancel);
        window.removeEventListener("keydown", key, true);
        window.removeEventListener("blur", cancel);
        if (root.hasPointerCapture(e.pointerId)) root.releasePointerCapture(e.pointerId);
        document.documentElement.style.cursor = previousCursor;
        document.documentElement.style.userSelect = previousSelection;
        const drop = commit ? current?.drop : null;
        const sorted = !!lifted && drop?.target.type === "tabs";
        cleanup.current = null;
        setDrag(null);
        if (!sorted) {
          // Cancelled: the gap closes and the tab glides back to its slot.
          sorter?.show(undefined);
          if (lifted && origin && !drop) settle(lifted.el, origin, () => sorter?.clear());
          else {
            lifted?.el.remove();
            sorter?.clear();
          }
          origin?.removeAttribute("data-drag-source");
        }
        if (active) {
          // A drag can start on a launcher button; its trailing click must not
          // launch again after docking (or after Escape cancels the gesture).
          const suppress = (event: MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();
          };
          // The click (if any) is dispatched right after pointerup. An Escape
          // cancel happens while the button is still down, so keep covering
          // until the next pointerup has passed.
          window.addEventListener("click", suppress, { capture: true, once: true });
          const release = () =>
            setTimeout(() => window.removeEventListener("click", suppress, true), 0);
          if (!buttonStillDown) release();
          else window.addEventListener("pointerup", release, { capture: true, once: true });
        }
        if (drop) {
          const before = getWorkspace();
          // Sorted: commit the new order synchronously, drop the shifts in the
          // same frame (the DOM order now matches them), and land the lifted
          // tab in its real slot.
          if (sorted) flushSync(() => dispatch({ type: "dock", source, target: drop.target }));
          else dispatch({ type: "dock", source, target: drop.target });
          if (getWorkspace() !== before) trackWorkspaceAction("drag-dock");
          if (sorted && lifted) {
            sorter?.clear();
            origin?.removeAttribute("data-drag-source");
            const id = (source as { tabId: string }).tabId;
            const landed = root.querySelector<HTMLElement>(`[data-tab-id="${CSS.escape(id)}"]`);
            if (landed) settle(lifted.el, landed);
            else lifted.el.remove();
          }
        }
      };
      const up = (event: globalThis.PointerEvent) => {
        if (event.pointerId !== e.pointerId) return;
        point = { x: event.clientX, y: event.clientY };
        finish(true);
      };
      const cancel = () => finish(false);
      const key = (event: KeyboardEvent) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        finish(false, true);
      };
      cleanup.current = cancel;
      window.addEventListener("pointermove", move, { passive: false });
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", cancel);
      window.addEventListener("keydown", key, true);
      window.addEventListener("blur", cancel);
    },
    [ref],
  );

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0 || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const hit = e.target as Element;
      if (hit.closest("button, a, input, [role=menu]")) return;
      const header = hit.closest<HTMLElement>("[data-island-header]");
      const islandId = header?.closest<HTMLElement>("[data-island]")?.dataset.island;
      if (!islandId) return;
      const tabId = hit.closest<HTMLElement>("[data-tab-id]")?.dataset.tabId;
      const source: DockSource = tabId ? { type: "tab", tabId } : { type: "island", islandId };
      const ws = getWorkspace();
      const island = findIsland(ws.layout, islandId);
      if (!island) return;
      const tab = tabId ? findTab(ws.layout, tabId)?.tab : selectedTab(island);
      if (!tab) return;
      const label =
        getTabMeta(hrefPathname(tab.href)).label + (tabId ? "" : ` · ${island.tabs.length} tabs`);
      beginDrag(e, source, label);
    },
    [beginDrag],
  );

  return { beginDrag, onPointerDown, overlay: <DockingOverlay /> };
}

/**
 * A pixel copy of the tab, fixed to the viewport and lifted off the strip. It
 * lives outside React: it only follows the pointer and is gone on drop.
 */
function liftCopy(tab: HTMLElement, grab: { x: number; y: number }) {
  const rect = tab.getBoundingClientRect();
  const el = tab.cloneNode(true) as HTMLElement;
  for (const node of [el, ...el.querySelectorAll("*")]) {
    for (const attr of [
      "id",
      "role",
      "tabindex",
      "aria-controls",
      "aria-selected",
      "data-tab-id",
      "data-drag-source",
    ])
      node.removeAttribute(attr);
  }
  el.setAttribute("aria-hidden", "true");
  el.setAttribute("data-dock-ghost", "");
  Object.assign(el.style, {
    position: "fixed",
    left: "0",
    top: "0",
    zIndex: "50",
    width: `${rect.width}px`,
    pointerEvents: "none",
    transform: `translate(${rect.left}px, ${rect.top}px)`,
  });
  el.classList.add("shadow-md");
  document.body.appendChild(el);
  return { el, dx: grab.x - rect.left, dy: grab.y - rect.top };
}

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
const SORT_MS = 160;
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function stripOf(root: HTMLElement, islandId: string) {
  return root
    .querySelector(`[data-island="${CSS.escape(islandId)}"]`)
    ?.querySelector<HTMLElement>("[data-tab-strip]");
}

const within = (r: DOMRect, p: { x: number; y: number }) =>
  p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;

/** Gap between a tab's bottom and its strip's, so a riding tab sits level. */
function stripInset(tab: HTMLElement) {
  const strip = tab.closest("[data-tab-strip]");
  return strip ? strip.getBoundingClientRect().bottom - tab.getBoundingClientRect().bottom : 0;
}

/**
 * Live sorting: while a tab hovers a strip, the tabs there slide aside to
 * open its landing gap. Shifts are transforms on the real tabs, so nothing
 * re-renders mid-drag; the order itself changes only on drop.
 */
function createSorter(root: HTMLElement, origin: HTMLElement) {
  const strip = origin.closest<HTMLElement>("[data-tab-strip]");
  const gap = strip ? Number.parseFloat(getComputedStyle(strip).columnGap) || 0 : 0;
  const width = origin.offsetWidth + gap;
  const tabs = [...root.querySelectorAll<HTMLElement>("[data-tab-id]")];
  const transition = reducedMotion() ? "none" : `transform ${SORT_MS}ms ${EASE}`;
  for (const tab of tabs) tab.style.transition = transition;

  return {
    show(target: DockTarget | undefined) {
      const into = target?.type === "tabs" ? stripOf(root, target.islandId) : null;
      const row = into ? [...into.querySelectorAll<HTMLElement>("[data-tab-id]")] : [];
      const from = row.indexOf(origin);
      const to = target?.type === "tabs" ? target.index : -1;
      for (const tab of tabs) {
        const i = row.indexOf(tab);
        let shift = 0;
        if (i >= 0 && tab !== origin) {
          if (from < 0) shift = i >= to ? width : 0;
          else if (to > from) shift = i > from && i < to ? -width : 0;
          else shift = i >= to && i < from ? width : 0;
        }
        tab.style.transform = shift ? `translateX(${shift}px)` : "";
      }
      // Sorting its own strip, the tab's slot is the moving gap itself.
      origin.style.opacity = from >= 0 ? "0" : "";
    },
    clear() {
      for (const tab of tabs) {
        tab.style.transition = "";
        tab.style.transform = "";
      }
      origin.style.opacity = "";
    },
  };
}

/** Glide the lifted copy onto a tab's real slot, then hand back to the tab. */
function settle(copy: HTMLElement, tab: HTMLElement, done?: () => void) {
  const to = tab.getBoundingClientRect();
  const finish = () => {
    copy.remove();
    tab.style.opacity = "";
    done?.();
  };
  if (reducedMotion()) return finish();
  tab.style.opacity = "0";
  const animation = copy.animate(
    [
      { transform: copy.style.transform },
      { transform: `translate(${to.left}px, ${to.top}px)`, boxShadow: "none" },
    ],
    { duration: SORT_MS, easing: EASE, fill: "forwards" },
  );
  animation.onfinish = finish;
  animation.oncancel = finish;
}

/** Glides between drop targets the way the prototype does, and fades in and out. */
const PREVIEW_MOTION =
  "transition-[left,top,width,height,opacity] duration-[110ms,110ms,110ms,110ms,90ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none";

function DockingOverlay() {
  const drag = useDragStore((state) => state.drag);
  // Keep the last target so the preview fades out where it was, instead of
  // vanishing, when the pointer leaves every drop zone.
  const last = useRef<Drop | null>(null);
  if (!drag) last.current = null;
  else if (drag.drop) last.current = drag.drop;
  const shown = last.current;
  return (
    drag &&
    createPortal(
      <>
        {shown && !(drag.lifted && shown.target.type === "tabs") && (
          <div
            data-dock-preview={shown.line ? "insert" : shown.target.type}
            aria-hidden
            style={shown.rect}
            className={cn(
              "pointer-events-none fixed z-40 animate-in fade-in-0 duration-[90ms]",
              PREVIEW_MOTION,
              !drag.drop && "opacity-0",
              shown.line
                ? // Above the lifted tab, which would otherwise cover the gap it marks.
                  "z-[60] rounded-full bg-primary"
                : "grid place-items-center rounded-island bg-[color-mix(in_oklab,var(--color-brand)_12%,transparent)] ring-1 ring-primary/40",
            )}
          >
            {!shown.line && shown.label && (
              <span
                data-dock-label
                className="rounded-full bg-popover px-2.5 py-1 font-medium text-caption text-foreground shadow-md ring-1 ring-foreground/10"
              >
                {shown.label}
              </span>
            )}
          </div>
        )}
        {!drag.lifted && (
          <div
            data-dock-ghost
            aria-hidden
            style={{
              left: Math.min(drag.x + 12, window.innerWidth - 264),
              top: Math.min(drag.y + 10, window.innerHeight - 44),
            }}
            className="pointer-events-none fixed z-50 max-w-64 truncate rounded-lg bg-popover px-3 py-2 text-ui shadow-md ring-1 ring-foreground/10"
          >
            {drag.label}
          </div>
        )}
      </>,
      document.body,
    )
  );
}

/** Set by `findDrop` when it scrolled a tab strip, so the drag loop keeps going. */
const stripScroll = { active: false };

function findDrop(root: HTMLElement, source: DockSource, x: number, y: number): Drop | null {
  const ws = getWorkspace();
  const outer = root.getBoundingClientRect();
  if (x < outer.left - 16 || x > outer.right + 16 || y < outer.top || y > outer.bottom + 8)
    return null;
  // Edge zones belong to the islands, not to the area that also hosts the
  // sidebar: "window left" is the left edge of the leftmost island column.
  const bounds = root.querySelector("[data-workspace-layout]")?.getBoundingClientRect() ?? outer;
  if (x < bounds.left - 24) return null;
  let target: DockTarget | undefined;
  let line: Rect | undefined;
  // A compact pinned tab can sit inside the window-edge hit area. Keep
  // insertion reachable across the entire tab strip, including those pins.
  const overStrip = document.elementFromPoint(x, y)?.closest("[data-tab-strip]");
  if (!overStrip && x < bounds.left + 24) target = { type: "workspace-edge", side: "left" };
  else if (!overStrip && x > bounds.right - 24) target = { type: "workspace-edge", side: "right" };
  else if (y > bounds.bottom - 24) target = { type: "workspace-edge", side: "bottom" };
  else
    for (const el of root.querySelectorAll<HTMLElement>("[data-island]")) {
      const rect = el.getBoundingClientRect();
      if (
        !rect.width ||
        !rect.height ||
        x < rect.left ||
        x > rect.right ||
        y < rect.top ||
        y > rect.bottom
      )
        continue;
      const islandId = el.dataset.island!;
      const strip = el.querySelector<HTMLElement>("[data-tab-strip]");
      const stripRect = strip?.getBoundingClientRect();
      if (
        strip &&
        stripRect &&
        y <= stripRect.bottom &&
        x >= stripRect.left &&
        x <= stripRect.right
      ) {
        // Scroll overflowing strips while holding near either end.
        const step = x < stripRect.left + 20 ? -8 : x > stripRect.right - 20 ? 8 : 0;
        const before = strip.scrollLeft;
        if (step) strip.scrollLeft += step;
        stripScroll.active = strip.scrollLeft !== before;
        const tabs = [...strip.querySelectorAll<HTMLElement>("[data-tab-id]")];
        // Home slots, not on-screen rects: live sorting shifts tabs with
        // transforms, and measuring those would make the target flicker.
        const home = (tab: HTMLElement | undefined) =>
          tab && {
            left: stripRect.left + tab.offsetLeft - strip.scrollLeft,
            right: stripRect.left + tab.offsetLeft - strip.scrollLeft + tab.offsetWidth,
          };
        let index = tabs.findIndex((tab) => {
          const r = home(tab)!;
          return x < (r.left + r.right) / 2;
        });
        if (index < 0) index = tabs.length;
        // The line must describe the legal insertion gap: pinned tabs stay
        // before ordinary tabs even when the pointer crosses that boundary.
        if (source.type === "tab") {
          const from = findTab(ws.layout, source.tabId);
          const pins = findIsland(ws.layout, islandId)?.pinned.length ?? 0;
          index = from?.island.pinned.includes(source.tabId)
            ? Math.min(index, pins)
            : Math.max(index, pins);
        } else if (source.type === "href") {
          index = Math.max(index, findIsland(ws.layout, islandId)?.pinned.length ?? 0);
        }
        const next = home(tabs[index]);
        const previous = home(tabs[index - 1]);
        const left = Math.max(
          stripRect.left,
          Math.min(next?.left ?? previous?.right ?? stripRect.left, stripRect.right - 2),
        );
        target = { type: "tabs", islandId, index };
        line = { left, top: stripRect.top + 6, width: 2, height: stripRect.height - 12 };
      } else {
        // Nearest edge as a share of the island's size; within EDGE_ZONE it
        // splits, otherwise the centre moves into the island.
        const edges = [
          { side: "left" as const, distance: (x - rect.left) / rect.width / EDGE_ZONE },
          { side: "right" as const, distance: (rect.right - x) / rect.width / EDGE_ZONE },
          { side: "top" as const, distance: (y - rect.top) / rect.height / EDGE_ZONE },
          { side: "bottom" as const, distance: (rect.bottom - y) / rect.height / EDGE_ZONE },
        ].sort((a, b) => a.distance - b.distance);
        const edge = edges[0]!;
        const sameIsland =
          source.type === "island"
            ? source.islandId === islandId
            : source.type === "tab" && findTab(ws.layout, source.tabId)?.island.id === islandId;
        // Dropping on your own island body means "never mind", not "move to end".
        if (edge.distance >= 1 && sameIsland) return null;
        target =
          edge.distance < 1
            ? { type: "island-edge", islandId, side: edge.side }
            : {
                type: "tabs",
                islandId,
                index: findIsland(ws.layout, islandId)?.tabs.length ?? 0,
              };
      }
      break;
    }
  if (!target) return null;
  // Preview the actual command result, fitted to the minimum island size
  // exactly as the drop will commit it: removing the source can collapse or
  // flatten splits, so a naive half of the old target would be misleading.
  // A drop with no room for its island offers no target at all.
  const next = previewCommand({ type: "dock", source, target });
  if (!next) return null;
  if (line) return { target, rect: line, line: true };
  const layoutBounds = bounds;
  const label = dropLabel(source, target);
  if (useWorkspaceView.getState().narrow) {
    return {
      target,
      rect: {
        left: layoutBounds.left,
        top: layoutBounds.top,
        width: layoutBounds.width,
        height: layoutBounds.height,
      },
      line: false,
      label,
    };
  }
  const geometry = layoutGeometry(next.layout, {
    left: layoutBounds.left,
    top: layoutBounds.top,
    width: layoutBounds.width,
    height: layoutBounds.height,
  });
  const rect = geometry.islands.get(next.focusedIslandId);
  return rect ? { target, rect, line: false, label } : null;
}
