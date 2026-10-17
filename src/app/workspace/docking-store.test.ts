import { beforeEach, expect, test } from "bun:test";
import { createWorkspace, focusedIsland, islands } from "@/app/workspace/model";
import { dispatch, getWorkspace, useWorkspaceStore } from "@/app/workspace/store";

beforeEach(() =>
  useWorkspaceStore.setState({
    workspace: createWorkspace(["/"]),
    undo: [],
    notice: null,
    dockingRevision: 0,
  }),
);

test("merging islands offers undo that restores sizes and keeps a surviving tab's navigation", () => {
  dispatch({ type: "openTab", href: "/two" });
  dispatch({ type: "splitIsland", side: "right" });
  const before = getWorkspace();
  const [left, right] = islands(before.layout);
  const tabId = right!.selectedTabId;
  dispatch({
    type: "dock",
    source: { type: "island", islandId: right!.id },
    target: { type: "tabs", islandId: left!.id, index: 1 },
  });
  expect(islands(getWorkspace().layout)).toHaveLength(1);
  expect(useWorkspaceStore.getState().notice?.label).toBe("Islands merged");
  dispatch({ type: "navigate", tabId, href: "/two/deeper" });
  dispatch({ type: "undo" });
  expect(islands(getWorkspace().layout).map((island) => island.id)).toEqual([left!.id, right!.id]);
  expect(focusedIsland(getWorkspace()).tabs[0]?.href).toBe("/two/deeper");
  const restored = getWorkspace().layout;
  expect(restored.kind === "split" && restored.sizes).toEqual([0.5, 0.5]);
});

test("undo restores an island with several tabs, its sizes and its selected tab", () => {
  dispatch({ type: "splitIsland", side: "right" });
  dispatch({ type: "openTab", href: "/two" });
  const split = getWorkspace().layout;
  dispatch({ type: "resizeGap", splitId: split.id, gap: 0, delta: 100, extent: 1008 });
  const before = getWorkspace();
  dispatch({ type: "closeIsland", islandId: before.focusedIslandId });
  expect(islands(getWorkspace().layout)).toHaveLength(1);
  expect(useWorkspaceStore.getState().notice?.label).toBe("Island closed");
  dispatch({ type: "undo" });
  expect(getWorkspace()).toEqual(before);
});

test("closing other tabs offers undo and later opened tabs are undone first", () => {
  dispatch({ type: "openTab", href: "/two" });
  dispatch({ type: "openTab", href: "/three" });
  const before = getWorkspace();
  dispatch({ type: "closeOtherTabs", tabId: focusedIsland(before).selectedTabId });
  expect(useWorkspaceStore.getState().notice?.label).toBe("Other tabs closed");
  dispatch({ type: "openTab", href: "/four" });
  dispatch({ type: "undo" });
  expect(focusedIsland(getWorkspace()).tabs.map((tab) => tab.href)).toEqual(["/three"]);
  dispatch({ type: "undo" });
  expect(getWorkspace()).toEqual(before);
});

test("undoing a pin preserves the tab opened before it", () => {
  dispatch({ type: "openTab", href: "/two" });
  const before = getWorkspace();
  dispatch({ type: "pinTab", tabId: focusedIsland(before).selectedTabId, pinned: true });
  dispatch({ type: "undo" });
  expect(getWorkspace()).toEqual(before);
});

test("launcher and side openings undo before earlier layout changes", () => {
  dispatch({ type: "openTab", href: "/two" });
  const before = getWorkspace();
  dispatch({ type: "openOrJump", href: "/three" });
  const launched = getWorkspace();
  dispatch({ type: "openToSide", href: "/four" });
  dispatch({ type: "undo" });
  expect(getWorkspace()).toEqual(launched);
  dispatch({ type: "undo" });
  expect(getWorkspace()).toEqual(before);
});

test("reset layout gathers every tab and pin into one island and can be undone", () => {
  dispatch({ type: "openTab", href: "/demo/project/issues" });
  dispatch({ type: "splitIsland", side: "right" });
  const selected = focusedIsland(getWorkspace()).selectedTabId;
  dispatch({ type: "pinTab", tabId: selected, pinned: true });
  dispatch({ type: "toggleMaximize" });
  const before = getWorkspace();
  const tabIds = islands(before.layout).flatMap((island) => island.tabs.map((tab) => tab.id));
  dispatch({ type: "resetLayout" });
  const after = getWorkspace();
  expect(islands(after.layout)).toHaveLength(1);
  expect(
    focusedIsland(after)
      .tabs.map((tab) => tab.id)
      .sort(),
  ).toEqual(tabIds.sort());
  expect(focusedIsland(after).selectedTabId).toBe(selected);
  expect(focusedIsland(after).pinned).toContain(selected);
  expect(after.maximizedIslandId).toBeNull();
  dispatch({ type: "undo" });
  expect(getWorkspace()).toEqual(before);
});
