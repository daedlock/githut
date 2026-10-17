import {
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { createPortal } from "react-dom";
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
        if (lifted) {
          const x = Math.min(point.x - lifted.dx, window.innerWidth - lifted.el.offsetWidth);
          lifted.el.style.transform = `translate(${x}px, ${point.y - lifted.dy}px)`;
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
          if (source.type === "tab" && origin) lifted = liftCopy(origin, start);
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
        origin?.removeAttribute("data-drag-source");
        lifted?.el.remove();
        cleanup.current = null;
        setDrag(null);
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
        if (commit && current?.drop) {
          const before = getWorkspace();
          dispatch({ type: "dock", source, target: current.drop.target });
          if (getWorkspace() !== before) trackWorkspaceAction("drag-dock");
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
        {shown && (
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
        let index = tabs.findIndex((tab) => {
          const r = tab.getBoundingClientRect();
          return x < r.left + r.width / 2;
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
        const next = tabs[index]?.getBoundingClientRect();
        const previous = tabs[index - 1]?.getBoundingClientRect();
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
