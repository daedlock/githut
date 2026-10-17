import { islands, type LayoutNode } from "./model";

export const KEEP_ALIVE_BUDGET = 8;

/** Open tabs to keep mounted: the eight most recent, every pin and every selected tab. */
export function keepAliveTabs(layout: LayoutNode, recent: readonly string[]): Set<string> {
  const all = islands(layout);
  const open = new Set(all.flatMap((island) => island.tabs.map((tab) => tab.id)));
  const newest = [...new Set(recent)].filter((id) => open.has(id)).slice(0, KEEP_ALIVE_BUDGET);
  return new Set([...newest, ...all.flatMap((island) => [island.selectedTabId, ...island.pinned])]);
}
