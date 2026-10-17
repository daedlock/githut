import {
  findIsland,
  findTab,
  type Island,
  insertBeside,
  newId,
  newIsland,
  normalizeLayout,
  replaceNode,
  reselect,
  type Side,
  type Workspace,
} from "@/app/workspace/model";

export type DockSource =
  | { type: "tab"; tabId: string }
  | { type: "island"; islandId: string }
  | { type: "href"; href: string };
export type DockTarget =
  | { type: "tabs"; islandId: string; index: number }
  | { type: "island-edge"; islandId: string; side: Side }
  | { type: "workspace-edge"; side: Exclude<Side, "top"> };
export type DockingCommand = { type: "dock"; source: DockSource; target: DockTarget };

/** Move existing tabs, retaining their ids, router history, selection and pinned status. */
export function applyDock(ws: Workspace, source: DockSource, target: DockTarget): Workspace {
  if (source.type === "href") {
    const dest =
      target.type === "workspace-edge" ? undefined : findIsland(ws.layout, target.islandId);
    if (target.type !== "workspace-edge" && !dest) return ws;
    const added = newIsland([source.href]);
    if (target.type === "tabs" && dest) {
      const tabs = [...dest.tabs];
      tabs.splice(
        Math.max(dest.pinned.length, Math.min(target.index, tabs.length)),
        0,
        added.tabs[0]!,
      );
      return {
        ...ws,
        layout: replaceNode(ws.layout, dest.id, {
          ...dest,
          tabs,
          selectedTabId: added.selectedTabId,
        }),
        focusedIslandId: dest.id,
        maximizedIslandId: null,
      };
    }
    if (target.type === "tabs") return ws;
    return {
      ...ws,
      layout: insertBeside(ws.layout, dest?.id ?? ws.layout.id, target.side, added),
      focusedIslandId: added.id,
      maximizedIslandId: null,
    };
  }
  const found = source.type === "tab" ? findTab(ws.layout, source.tabId) : undefined;
  const from = source.type === "tab" ? found?.island : findIsland(ws.layout, source.islandId);
  if (!from) return ws;
  const dest =
    target.type === "workspace-edge" ? undefined : findIsland(ws.layout, target.islandId);
  if (target.type !== "workspace-edge" && !dest) return ws;
  const tabs = found ? [found.tab] : from.tabs;
  const ids = new Set(tabs.map((tab) => tab.id));
  const movingAll = tabs.length === from.tabs.length;
  if (dest?.id === from.id && (source.type === "island" || (movingAll && target.type !== "tabs")))
    return ws;

  if (target.type === "tabs") {
    if (!dest) return ws;
    // The drop index is a gap in the original strip, before removing the source.
    const at = Math.max(0, Math.min(target.index, dest.tabs.length));
    const insertion = at - dest.tabs.slice(0, at).filter((tab) => ids.has(tab.id)).length;
    const remaining = dest.tabs.filter((tab) => !ids.has(tab.id));
    remaining.splice(insertion, 0, ...tabs);
    const pinned = [
      ...dest.pinned,
      ...from.pinned.filter((id) => ids.has(id) && !dest.pinned.includes(id)),
    ];
    // Pins always occupy the start of the strip, including after cross-island moves.
    const ordered = [
      ...remaining.filter((tab) => pinned.includes(tab.id)),
      ...remaining.filter((tab) => !pinned.includes(tab.id)),
    ];
    if (dest.id === from.id && ordered.every((tab, index) => tab === dest.tabs[index])) return ws;
    let layout =
      dest.id === from.id ? ws.layout : replaceNode(ws.layout, from.id, withoutTabs(from, ids));
    layout = replaceNode(layout, dest.id, {
      ...dest,
      tabs: ordered,
      pinned,
      selectedTabId: found?.tab.id ?? from.selectedTabId,
    });
    return { ...ws, layout, focusedIslandId: dest.id, maximizedIslandId: null };
  }

  // Moving a whole island retains its id and all mounted pages. A tab split
  // gets a new island but keeps the tab id used by router and scroll memory.
  const moved: Island = movingAll
    ? from
    : {
        kind: "island",
        id: newId("i"),
        tabs,
        selectedTabId: tabs[0]!.id,
        pinned: from.pinned.filter((id) => ids.has(id)),
      };
  const remainder = normalizeLayout(replaceNode(ws.layout, from.id, withoutTabs(from, ids)));
  if (!remainder) return ws;
  const targetId = target.type === "workspace-edge" ? remainder.id : dest!.id;
  const layout = insertBeside(remainder, targetId, target.side, moved);
  return { ...ws, layout, focusedIslandId: moved.id, maximizedIslandId: null };
}

function withoutTabs(island: Island, ids: Set<string>): Island {
  return {
    ...island,
    tabs: island.tabs.filter((tab) => !ids.has(tab.id)),
    pinned: island.pinned.filter((id) => !ids.has(id)),
    selectedTabId: reselect(island, [...ids]),
  };
}
