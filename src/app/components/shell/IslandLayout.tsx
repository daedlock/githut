import { Columns2, Maximize2, Minimize2, Rows2 } from "lucide-react";
import {
  type KeyboardEvent,
  memo,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { BreadcrumbRow } from "@/app/components/shell/BreadcrumbRow";
import { DockingMenu } from "@/app/components/shell/DockingMenu";
import { IslandSwitcher } from "@/app/components/shell/IslandSwitcher";
import { SidebarToggle } from "@/app/components/shell/SidebarControls";
import { TabStrip } from "@/app/components/shell/TabStrip";
import { Button } from "@/app/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import { cn } from "@/app/lib/cn";
import { focusIsland, splitIsland, toggleMaximize } from "@/app/lib/tabActions";
import { getTabMeta } from "@/app/lib/tabMeta";
import { useWorkspaceView } from "@/app/stores/workspaceView";
import { type GapGeometry, layoutGeometry, type Rect } from "@/app/workspace/geometry";
import {
  findSplit,
  hrefPathname,
  type Island,
  islands,
  type LayoutNode,
  pathTo,
  resizedGapSizes,
  selectedTab,
} from "@/app/workspace/model";
import { dispatch, getWorkspace, useWorkspaceStore } from "@/app/workspace/store";

// ─── IslandLayout ──────────────────────────────────────────────────────────
//
// Renders the layout tree: islands and the gaps between them, as flat,
// absolutely positioned siblings (see workspace/geometry). Splitting, closing
// or resizing therefore never re-parents an island, and its mounted tabs keep
// their state.
//
//   ╭ island ╮ ┊ ╭ island ╮      ┊ = gap: a focusable separator. Drag or
//   │        │ ┊ ├────────┤          arrow keys resize (16px, ⇧ 64px,
//   ╰────────╯ ┊ ╰ island ╯          Home/End to the limit); double-click
//                                    equalizes.
//
// A maximized island fills the workspace; the others stay mounted but hidden,
// and the layout keeps their sizes for restore.

const STEP = 16;
const BIG_STEP = 64;

type Preview = { splitId: string; sizes: number[] } | null;

export function IslandLayout({
  layout,
  focusedIslandId,
  maximizedIslandId,
  narrow = false,
  renderPanes,
}: {
  layout: LayoutNode;
  focusedIslandId: string;
  maximizedIslandId: string | null;
  narrow?: boolean;
  /** The island's mounted tab panes; `shown` is false while it's hidden. */
  renderPanes: (island: Island, shown: boolean) => ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [preview, setPreview] = useState<Preview>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sync = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const all = islands(layout);
  const full: Rect = { left: 0, top: 0, width: size?.width ?? 0, height: size?.height ?? 0 };
  const geometry = size ? layoutGeometry(layout, full, preview) : null;
  const maximized = maximizedIslandId && pathTo(layout, maximizedIslandId).length > 0;

  return (
    <div ref={ref} data-workspace-layout className="relative min-h-0 flex-1">
      {geometry &&
        all.map((island) => {
          const shown = narrow
            ? island.id === focusedIslandId
            : !maximized || island.id === maximizedIslandId;
          return (
            <IslandFrame
              key={island.id}
              island={island}
              rect={(narrow || maximized) && shown ? full : geometry.islands.get(island.id)!}
              shown={shown}
              focused={island.id === focusedIslandId}
              maximized={!!maximized && shown}
              canMaximize={layout.kind === "split"}
              renderPanes={renderPanes}
            />
          );
        })}
      {geometry &&
        !maximized &&
        !narrow &&
        geometry.gaps.map((gap) => (
          <Gap
            key={`${gap.splitId}:${gap.index}`}
            gap={gap}
            sizes={
              preview?.splitId === gap.splitId
                ? preview.sizes
                : (findSplit(layout, gap.splitId)?.sizes ?? [])
            }
            onPreview={setPreview}
          />
        ))}
    </div>
  );
}

// ─── Island ────────────────────────────────────────────────────────────────

/** When the last dock committed; islands mounting right after it animate in. */
let dockedAt = Number.NEGATIVE_INFINITY;
useWorkspaceStore.subscribe((state, prev) => {
  if (state.dockingRevision !== prev.dockingRevision) dockedAt = performance.now();
});

const sameRect = (a: Rect, b: Rect) =>
  a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;

/**
 * Memoized with a by-value rect comparison: a gap drag re-lays out only the
 * islands whose rectangles actually change.
 */
const IslandFrame = memo(
  function IslandFrame({
    island,
    rect,
    shown,
    focused,
    maximized,
    canMaximize,
    renderPanes,
  }: {
    island: Island;
    rect: Rect;
    shown: boolean;
    focused: boolean;
    maximized: boolean;
    canMaximize: boolean;
    renderPanes: (island: Island, shown: boolean) => ReactNode;
  }) {
    const href = selectedTab(island).href;
    const frame = useRef<HTMLElement>(null);
    const revision = useWorkspaceStore((s) => s.dockingRevision);
    // `previous` is the rectangle at the last commit; `latest` the one being
    // committed now. Both are refs so the glide effect can key on the docking
    // revision alone: unrelated re-renders mid-glide must not cancel it.
    const previous = useRef(rect);
    const latest = useRef({ rect, shown });
    latest.current = { rect, shown };
    // Glide to the new rectangle after a dock, transform-based (FLIP) so heavy
    // pages aren't re-laid out every frame.
    const lastRevision = useRef(revision);
    useLayoutEffect(() => {
      if (lastRevision.current === revision) return;
      lastRevision.current = revision;
      const before = previous.current;
      const { rect: after, shown: visible } = latest.current;
      const el = frame.current;
      if (
        !el ||
        !visible ||
        sameRect(before, after) ||
        !after.width ||
        !after.height ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      )
        return;
      const dx = before.left - after.left;
      const dy = before.top - after.top;
      const sx = before.width / after.width;
      const sy = before.height / after.height;
      const animation = el.animate(
        [
          { transformOrigin: "0 0", transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
          { transformOrigin: "0 0", transform: "none" },
        ],
        { duration: 220, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
      );
      return () => animation.cancel();
    }, [revision]);
    useLayoutEffect(() => {
      previous.current = rect;
    });
    // An island a dock just created grows in from its slot rather than popping.
    useLayoutEffect(() => {
      const el = frame.current;
      if (!el || performance.now() - dockedAt > 300) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      el.animate(
        [
          { opacity: 0, transform: "scale(0.97)" },
          { opacity: 1, transform: "none" },
        ],
        {
          duration: 200,
          easing: "cubic-bezier(0.16, 1, 0.3, 1)",
        },
      );
    }, []);
    return (
      <section
        ref={frame}
        aria-label={islandName(href)}
        data-island={island.id}
        data-focused={focused || undefined}
        // Only DOM descendants focus this island: portaled menus can select another island.
        onPointerDownCapture={(event) => {
          if (event.currentTarget.contains(event.target as Node)) focusIsland(island.id);
        }}
        onFocusCapture={(event) => {
          if (event.currentTarget.contains(event.target as Node)) focusIsland(island.id);
        }}
        style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
        className={cn(
          "@container absolute flex-col data-drag-source:opacity-45",
          shown ? "flex" : "hidden",
        )}
      >
        {/* Tabs sit on the window frame, outside the island sheet; the
            selected tab joins the sheet below it like a file folder tab. */}
        <IslandHeader
          island={island}
          focused={focused}
          maximized={maximized}
          canMaximize={canMaximize}
        />
        <div
          data-island-sheet
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-hidden rounded-island bg-background",
            "transition-shadow duration-150",
            focused ? "shadow-(--island-shadow-focus)" : "shadow-(--island-shadow)",
          )}
        >
          <BreadcrumbRow island={island} focused={focused} />
          <div className="relative min-h-0 flex-1">{renderPanes(island, shown)}</div>
        </div>
      </section>
    );
  },
  (a, b) =>
    a.island === b.island &&
    sameRect(a.rect, b.rect) &&
    a.shown === b.shown &&
    a.focused === b.focused &&
    a.maximized === b.maximized &&
    a.canMaximize === b.canMaximize &&
    a.renderPanes === b.renderPanes,
);

const IslandHeader = memo(function IslandHeader({
  island,
  focused,
  maximized,
  canMaximize,
}: {
  island: Island;
  focused: boolean;
  maximized: boolean;
  canMaximize: boolean;
}) {
  const narrow = useWorkspaceView((state) => state.narrow);
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: double-click maximize is a mouse shortcut; the island menu offers the same action
    <div
      data-link-menu="off"
      data-island-header
      onDoubleClick={(e) => {
        if (!canMaximize) return;
        if ((e.target as Element).closest("button, a, nav, input, [role=menu]")) return;
        toggleMaximize(island.id);
      }}
      // Overlaps the sheet by 1px so the selected tab covers the sheet's top edge.
      className="relative z-10 -mb-px flex h-(--island-tabs-height) shrink-0 touch-none items-center gap-1 pr-0.5"
    >
      {narrow && focused && <SidebarToggle />}
      <TabStrip island={island} focused={focused} />
      {narrow && focused && <IslandSwitcher />}
      {/* The header holds only tabs and island actions; where you are, and
          the way around the repo, is the breadcrumb row below. Narrow mode
          drops the island menu (splits need room for two islands) for the
          switcher. */}
      {maximized && !narrow && (
        // The other islands are hidden, not closed: say so and offer the way back.
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              data-restore-layout
              aria-label="Restore layout"
              className="shrink-0 text-muted-foreground"
              onClick={() => toggleMaximize(island.id)}
            >
              <Minimize2 />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Restore layout · other islands are hidden</TooltipContent>
        </Tooltip>
      )}
      {!narrow && (
        <IslandMenu islandId={island.id} maximized={maximized} canMaximize={canMaximize} />
      )}
    </div>
  );
});

function IslandMenu({
  islandId,
  maximized,
  canMaximize,
}: {
  islandId: string;
  maximized: boolean;
  canMaximize: boolean;
}) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Island actions"
              className="shrink-0 text-muted-foreground"
            >
              <Columns2 />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">Island actions</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-56">
        <DockingMenu source={{ type: "island", islandId }} dropdown />
        <DropdownMenuItem onSelect={() => splitIsland("right", islandId)}>
          <Columns2 />
          Split right
          <DropdownMenuShortcut>Alt \</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => splitIsland("bottom", islandId)}>
          <Rows2 />
          Split down
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!canMaximize} onSelect={() => toggleMaximize(islandId)}>
          {maximized ? <Minimize2 /> : <Maximize2 />}
          {maximized ? "Restore" : "Maximize"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={!canMaximize}
          onSelect={() => dispatch({ type: "closeIsland", islandId })}
        >
          Close island
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Accessible island name: its selected tab's page and repo. */
function islandName(href: string): string {
  const meta = getTabMeta(hrefPathname(href));
  return meta.sublabel ? `${meta.label} · ${meta.sublabel}` : meta.label;
}

// ─── Gap ───────────────────────────────────────────────────────────────────

function Gap({
  gap,
  sizes,
  onPreview,
}: {
  gap: GapGeometry;
  /** The split's sizes, or the previewed ones while it's dragged. */
  sizes: number[];
  onPreview: (preview: Preview) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const stop = useRef<(() => void) | null>(null);
  // A layout change by shortcut can unmount the gap mid-drag.
  useEffect(() => () => stop.current?.(), []);
  const row = gap.direction === "row";
  const a = sizes[gap.index] ?? 0;
  const b = sizes[gap.index + 1] ?? 0;
  const value = a + b > 0 ? Math.round((a / (a + b)) * 100) : 50;

  function resize(delta: number | "start" | "end") {
    dispatch({
      type: "resizeGap",
      splitId: gap.splitId,
      gap: gap.index,
      delta,
      extent: gap.extent,
    });
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    const start = findSplit(getWorkspace().layout, gap.splitId);
    if (!start) return;
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    el.focus({ preventScroll: true });
    setDragging(true);
    const origin = row ? e.clientX : e.clientY;
    const root = document.documentElement;
    root.style.cursor = row ? "col-resize" : "row-resize";
    root.style.userSelect = "none";
    let delta = 0;
    let frame = 0;

    // One preview per animation frame, however fast pointer events arrive.
    const preview = () => {
      frame = 0;
      onPreview({
        splitId: gap.splitId,
        sizes: resizedGapSizes(start, gap.index, delta, gap.extent),
      });
    };
    const move = (ev: globalThis.PointerEvent) => {
      delta = (row ? ev.clientX : ev.clientY) - origin;
      if (!frame) frame = requestAnimationFrame(preview);
    };
    const end = (commit: boolean) => {
      if (frame) cancelAnimationFrame(frame);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", cancel);
      el.removeEventListener("lostpointercapture", up);
      root.style.cursor = "";
      root.style.userSelect = "";
      stop.current = null;
      if (!el.isConnected) return;
      setDragging(false);
      onPreview(null);
      if (commit && delta) resize(delta);
    };
    const up = () => end(true);
    const cancel = () => end(false);
    stop.current = cancel;
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", cancel);
    el.addEventListener("lostpointercapture", up);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const back = row ? "ArrowLeft" : "ArrowUp";
    const forward = row ? "ArrowRight" : "ArrowDown";
    const step = e.shiftKey ? BIG_STEP : STEP;
    let delta: number | "start" | "end" | null = null;
    if (e.key === back) delta = -step;
    else if (e.key === forward) delta = step;
    else if (e.key === "Home") delta = "start";
    else if (e.key === "End") delta = "end";
    if (delta === null || e.altKey || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    e.stopPropagation();
    resize(delta);
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: a focusable, resizable separator (window splitter pattern); <hr> can't hold focus or children
    <div
      role="separator"
      tabIndex={0}
      aria-label="Resize islands"
      aria-orientation={row ? "vertical" : "horizontal"}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      data-gap
      data-dragging={dragging || undefined}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onDoubleClick={() => dispatch({ type: "equalizeSplit", splitId: gap.splitId })}
      style={{
        left: gap.rect.left,
        top: gap.rect.top,
        width: gap.rect.width,
        height: gap.rect.height,
      }}
      className={cn(
        "group/gap absolute z-10 touch-none outline-none",
        row ? "cursor-col-resize" : "cursor-row-resize",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute rounded-full bg-primary opacity-0 transition-opacity duration-150",
          "group-hover/gap:opacity-90 group-hover/gap:delay-150 group-focus-visible/gap:opacity-90 group-data-dragging/gap:opacity-100 group-data-dragging/gap:delay-0",
          row
            ? "top-[calc(var(--island-tabs-height)+0.75rem-1px)] bottom-3 left-1/2 w-0.5 -translate-x-1/2"
            : "inset-x-3 top-1/2 h-0.5 -translate-y-1/2",
        )}
      />
    </div>
  );
}
