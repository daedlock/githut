import { layoutGeometry } from "./geometry";
import {
  islands,
  type LayoutNode,
  MIN_ISLAND_HEIGHT,
  MIN_ISLAND_WIDTH,
  type Workspace,
} from "./model";

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
  const geometry = layoutGeometry(layout, {
    left: 0,
    top: 0,
    width: Math.max(0, width - sidebarWidth - 8),
    height,
  });
  return [...geometry.islands.values()].some(
    (rect) => rect.width < MIN_ISLAND_WIDTH || rect.height < MIN_ISLAND_HEIGHT,
  );
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
