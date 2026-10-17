import { layoutGeometry } from "./geometry";
import {
  ISLAND_GAP,
  islands,
  type LayoutNode,
  MIN_ISLAND_HEIGHT,
  MIN_ISLAND_WIDTH,
  minNodeSize,
  type Workspace,
} from "./model";

/** Room the islands get in px. */
export type Space = { width: number; height: number };

/** Whether every island of `layout` gets at least its minimum size in `space`. */
export function layoutFits(layout: LayoutNode, space: Space): boolean {
  const geometry = layoutGeometry(layout, { left: 0, top: 0, ...space });
  return [...geometry.islands.values()].every(
    (rect) => rect.width >= MIN_ISLAND_WIDTH && rect.height >= MIN_ISLAND_HEIGHT,
  );
}

/**
 * Shift split sizes so every child gets at least its minimum in `space`,
 * taking the room from siblings that have more than they need, in
 * proportion to their spare room. Splits that cannot honour every minimum
 * are left alone (the caller decides whether that layout is acceptable).
 * Untouched subtrees keep their identity.
 */
export function fitLayout(node: LayoutNode, space: Space): LayoutNode {
  if (node.kind === "island") return node;
  const row = node.direction === "row";
  const axis = row ? "width" : "height";
  const net = Math.max(
    0,
    (row ? space.width : space.height) - ISLAND_GAP * (node.children.length - 1),
  );
  let sizes = node.sizes;
  if (net > 0) {
    // One spare pixel per child absorbs whole-pixel rounding in layoutGeometry.
    const mins = node.children.map((child) => (minNodeSize(child, axis) + 1) / net);
    const need = mins.reduce((a, b) => a + b, 0);
    const short = node.sizes.some((size, i) => size < mins[i]! - 1e-9);
    if (short && need <= 1) {
      // Give every short child its minimum, then share what is left among
      // the others in proportion to how far they sit above their own.
      const spare = node.sizes.map((size, i) => Math.max(0, size - mins[i]!));
      const spareTotal = spare.reduce((a, b) => a + b, 0);
      sizes = mins.map((min, i) =>
        spareTotal > 0
          ? min + (spare[i]! / spareTotal) * (1 - need)
          : min + (1 - need) / mins.length,
      );
    }
  }
  let changed = sizes !== node.sizes;
  const children = node.children.map((child, i) => {
    const extent = net * sizes[i]!;
    const fitted = fitLayout(
      child,
      row ? { ...space, width: extent } : { ...space, height: extent },
    );
    if (fitted !== child) changed = true;
    return fitted;
  });
  return changed ? { ...node, children, sizes } : node;
}

/** Compare the saved layout with the space desktop mode would have, even while its sidebar is a drawer. */
export function isNarrowLayout(
  layout: LayoutNode,
  {
    width,
    height,
    viewportWidth,
    sidebarWidth,
  }: {
    width: number;
    height: number;
    viewportWidth: number;
    sidebarWidth: number;
  },
): boolean {
  if (viewportWidth < 720) return true;
  return !layoutFits(layout, desktopSpace({ width, height, sidebarWidth }));
}

/** The islands' room in desktop mode: the workspace area minus the sidebar and its gap. */
export function desktopSpace({
  width,
  height,
  sidebarWidth,
}: {
  width: number;
  height: number;
  sidebarWidth: number;
}): Space {
  return { width: Math.max(0, width - sidebarWidth - 8), height };
}

/** Presentation never changes the persisted tree or its saved relative sizes. */
export function visibleIslandIds(workspace: Workspace, narrow = false): Set<string> {
  const only = narrow ? workspace.focusedIslandId : workspace.maximizedIslandId;
  return new Set(
    islands(workspace.layout)
      .filter((island) => !only || island.id === only)
      .map((island) => island.id),
  );
}

export function visibleTabIds(workspace: Workspace, narrow = false): Set<string> {
  const shown = visibleIslandIds(workspace, narrow);
  return new Set(
    islands(workspace.layout)
      .filter((island) => shown.has(island.id))
      .map((island) => island.selectedTabId),
  );
}
