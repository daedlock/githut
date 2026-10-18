import { islands, type LayoutNode } from "./model";

export const KEEP_ALIVE_BUDGET = 8;

/**
 * Open tabs to keep mounted: the eight most recent, every pin and every shown
 * selection. Returns `previous` itself when it holds the same tabs, so a
 * focus change that mounts nothing new leaves every island's panes untouched.
 */
export function keepAliveTabs(
  layout: LayoutNode,
  recent: readonly string[],
  shown?: ReadonlySet<string>,
  previous?: ReadonlySet<string>,
): ReadonlySet<string> {
  const all = islands(layout);
  const open = new Set(all.flatMap((island) => island.tabs.map((tab) => tab.id)));
  const newest = [...new Set(recent)].filter((id) => open.has(id)).slice(0, KEEP_ALIVE_BUDGET);
  const next = new Set([
    ...newest,
    ...all.flatMap((island) => [
      ...(!shown || shown.has(island.id) ? [island.selectedTabId] : []),
      ...island.pinned,
    ]),
  ]);
  if (previous && previous.size === next.size && [...next].every((id) => previous.has(id)))
    return previous;
  return next;
}
