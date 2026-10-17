import {
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/app/lib/cn";
import { getTabMeta } from "@/app/lib/tabMeta";
import { applyDock, type DockSource, type DockTarget } from "@/app/workspace/docking";
import { layoutGeometry, type Rect } from "@/app/workspace/geometry";
import {
  findIsland,
  findTab,
  hrefPathname,
  normalizeWorkspace,
  selectedTab,
} from "@/app/workspace/model";
import { dispatch, getWorkspace } from "@/app/workspace/store";

type Drop = { target: DockTarget; rect: Rect; line: boolean };
type Drag = { source: DockSource; x: number; y: number; label: string; drop: Drop | null };

/** One pointer interaction spans every island; the layout changes only on drop. */
export function useDocking(ref: RefObject<HTMLDivElement | null>) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), []);

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
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
  }

  /** Adapters can start the same interaction without depending on island-header markup. */
  function beginDrag(e: ReactPointerEvent, source: DockSource, label: string) {
    if (e.button !== 0 || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const root = ref.current;
    if (!root) return;
    cleanup.current?.();
    const start = { x: e.clientX, y: e.clientY };
    let active = false;
    let current: Drag | null = null;
    let frame = 0;
    let point = start;
    const previousCursor = document.documentElement.style.cursor;
    const previousSelection = document.documentElement.style.userSelect;

    const update = () => {
      frame = 0;
      if (!active) return;
      current = { source, ...point, label, drop: findDrop(root, source, point.x, point.y) };
      setDrag(current);
    };
    const move = (event: globalThis.PointerEvent) => {
      if (event.pointerId !== e.pointerId) return;
      point = { x: event.clientX, y: event.clientY };
      if (!active && Math.hypot(point.x - start.x, point.y - start.y) < 5) return;
      if (!active) {
        active = true;
        root.setPointerCapture(e.pointerId);
        document.documentElement.style.cursor = "grabbing";
        document.documentElement.style.userSelect = "none";
      }
      event.preventDefault();
      if (!frame) frame = requestAnimationFrame(update);
    };
    const finish = (commit: boolean) => {
      if (frame) cancelAnimationFrame(frame);
      if (active && commit) update();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("blur", cancel);
      if (root.hasPointerCapture(e.pointerId)) root.releasePointerCapture(e.pointerId);
      document.documentElement.style.cursor = previousCursor;
      document.documentElement.style.userSelect = previousSelection;
      cleanup.current = null;
      setDrag(null);
      if (commit && current?.drop) dispatch({ type: "dock", source, target: current.drop.target });
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
      cancel();
    };
    cleanup.current = cancel;
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", key, true);
    window.addEventListener("blur", cancel);
  }

  return {
    beginDrag,
    onPointerDown,
    overlay:
      drag &&
      createPortal(
        <>
          {drag.drop && (
            <div
              data-dock-preview={drag.drop.line ? "insert" : drag.drop.target.type}
              aria-hidden
              style={drag.drop.rect}
              className={cn(
                "pointer-events-none fixed z-40",
                drag.drop.line
                  ? "rounded-full bg-primary"
                  : "rounded-island bg-[color-mix(in_oklab,var(--color-brand)_12%,transparent)] ring-1 ring-primary/40",
              )}
            />
          )}
          <div
            data-dock-ghost
            aria-hidden
            style={{ left: drag.x + 14, top: drag.y + 14 }}
            className="pointer-events-none fixed z-50 max-w-64 truncate rounded-lg bg-popover px-3 py-2 text-ui shadow-md ring-1 ring-foreground/10"
          >
            {drag.label}
          </div>
        </>,
        document.body,
      ),
  };
}

function findDrop(root: HTMLElement, source: DockSource, x: number, y: number): Drop | null {
  const ws = getWorkspace();
  const bounds = root.getBoundingClientRect();
  if (x < bounds.left - 16 || x > bounds.right + 16 || y < bounds.top || y > bounds.bottom + 8)
    return null;
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
        if (x < stripRect.left + 20) strip.scrollLeft -= 12;
        else if (x > stripRect.right - 20) strip.scrollLeft += 12;
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
        const edges = [
          { side: "left" as const, distance: (x - rect.left) / Math.min(72, rect.width / 4) },
          { side: "right" as const, distance: (rect.right - x) / Math.min(72, rect.width / 4) },
          { side: "top" as const, distance: (y - rect.top) / Math.min(72, rect.height / 4) },
          { side: "bottom" as const, distance: (rect.bottom - y) / Math.min(72, rect.height / 4) },
        ].sort((a, b) => a.distance - b.distance);
        const edge = edges[0]!;
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
  const result = applyDock(ws, source, target);
  if (result === ws) return null;
  if (line) return { target, rect: line, line: true };
  // Preview the actual command result: removing the source can collapse or
  // flatten splits, so a naive half of the old target would be misleading.
  const next = normalizeWorkspace(result);
  const geometry = layoutGeometry(next.layout, {
    left: bounds.left,
    top: bounds.top,
    width: bounds.width,
    height: bounds.height,
  });
  const rect = geometry.islands.get(next.focusedIslandId);
  return rect ? { target, rect, line: false } : null;
}
