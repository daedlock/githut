import { expect, test } from "bun:test";
import { createWorkspace, focusedTab, islands, runCommand } from "./model";
import { keepAliveTabs } from "./tabLifetime";
import { isNarrowLayout, visibleIslandIds } from "./view";

test("narrow presentation respects the window threshold and saved island dimensions without changing the layout", () => {
  let workspace = createWorkspace(["/one"]);
  const size = { width: 1000, height: 600, viewportWidth: 1100, sidebarWidth: 240 };
  expect(isNarrowLayout(workspace.layout, { ...size, viewportWidth: 719 })).toBe(true);
  expect(isNarrowLayout(workspace.layout, { ...size, viewportWidth: 720 })).toBe(false);
  workspace = runCommand(workspace, { type: "splitIsland", side: "right" });
  const before = structuredClone(workspace);
  expect(isNarrowLayout(workspace.layout, size)).toBe(false);
  expect(isNarrowLayout(workspace.layout, { ...size, width: 880 })).toBe(true);
  expect(isNarrowLayout(workspace.layout, { ...size, width: 880, sidebarWidth: 40 })).toBe(false);
  expect(isNarrowLayout(workspace.layout, { ...size, height: 199 })).toBe(true);
  expect(visibleIslandIds(workspace, true)).toEqual(new Set([workspace.focusedIslandId]));
  expect(visibleIslandIds(workspace, false).size).toBe(2);
  expect(workspace).toEqual(before);
});

test("hidden island selections do not escape the eight-tab memory budget; pins and shown pages survive", () => {
  let workspace = createWorkspace(["/0"]);
  const pinned = focusedTab(workspace).id;
  workspace = runCommand(workspace, { type: "pinTab", tabId: pinned, pinned: true });
  for (let i = 1; i < 12; i++)
    workspace = runCommand(workspace, { type: "splitIsland", side: "right" });
  const all = islands(workspace.layout);
  const recent = all
    .slice()
    .reverse()
    .map((island) => island.selectedTabId);
  const narrow = keepAliveTabs(workspace.layout, recent, visibleIslandIds(workspace, true));
  expect(narrow.size).toBe(9);
  expect(narrow.has(pinned)).toBe(true);
  expect(narrow.has(all[1]!.selectedTabId)).toBe(false);
  expect(keepAliveTabs(workspace.layout, recent, visibleIslandIds(workspace, false)).size).toBe(12);
  expect(islands(workspace.layout)).toHaveLength(12);
});
