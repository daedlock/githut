import { ISLAND_GAP, type LayoutNode, type SplitDirection } from "@/app/workspace/model";

// ─── Layout geometry ─────────────────────────────────────────────────────────
//
// Pixel rectangles for every island and gap in a layout, so the workspace can
// render islands as flat, absolutely positioned siblings. Flat rendering means
// splitting, closing or resizing never re-parents an island in the DOM, so
// its mounted tabs keep their state.

export type Rect = { left: number; top: number; width: number; height: number };

export type GapGeometry = {
  splitId: string;
  /** The gap sits between `children[index]` and `children[index + 1]`. */
  index: number;
  direction: SplitDirection;
  /** The split's size in px along its direction, gaps included. */
  extent: number;
  rect: Rect;
};

export type LayoutGeometry = {
  islands: Map<string, Rect>;
  gaps: GapGeometry[];
};

/**
 * Lay out `node` inside `rect`. `sizesOverride` substitutes one split's sizes,
 * which lets a gap being dragged preview its result without committing it.
 */
export function layoutGeometry(
  node: LayoutNode,
  rect: Rect,
  sizesOverride?: { splitId: string; sizes: number[] } | null,
): LayoutGeometry {
  const out: LayoutGeometry = { islands: new Map(), gaps: [] };

  const walk = (n: LayoutNode, r: Rect) => {
    if (n.kind === "island") {
      out.islands.set(n.id, r);
      return;
    }
    const row = n.direction === "row";
    const sizes = sizesOverride?.splitId === n.id ? sizesOverride.sizes : n.sizes;
    const extent = row ? r.width : r.height;
    const net = Math.max(0, extent - ISLAND_GAP * (n.children.length - 1));
    let at = row ? r.left : r.top;
    n.children.forEach((child, i) => {
      // Round edges to whole pixels so neighbours never overlap or leave seams.
      const start = Math.round(at);
      const end = Math.round(at + net * (sizes[i] ?? 0));
      walk(
        child,
        row
          ? { left: start, top: r.top, width: end - start, height: r.height }
          : { left: r.left, top: start, width: r.width, height: end - start },
      );
      at += net * (sizes[i] ?? 0);
      if (i < n.children.length - 1) {
        out.gaps.push({
          splitId: n.id,
          index: i,
          direction: n.direction,
          extent,
          rect: row
            ? { left: end, top: r.top, width: ISLAND_GAP, height: r.height }
            : { left: r.left, top: end, width: r.width, height: ISLAND_GAP },
        });
        at += ISLAND_GAP;
      }
    });
  };

  walk(node, rect);
  return out;
}
