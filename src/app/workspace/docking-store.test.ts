import { beforeEach, expect, test } from "bun:test";
import { createWorkspace, focusedIsland, islands } from "@/app/workspace/model";
import { dispatch, getWorkspace, undoLayout, useWorkspaceStore } from "@/app/workspace/store";

beforeEach(() =>
  useWorkspaceStore.setState({
    workspace: createWorkspace(["/"]),
    undo: [],
    redo: [],
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
  undoLayout();
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
  undoLayout();
  expect(getWorkspace()).toEqual(before);
});

test("closing other tabs offers undo that keeps tabs opened since", () => {
  dispatch({ type: "openTab", href: "/two" });
  dispatch({ type: "openTab", href: "/three" });
  const before = getWorkspace();
  dispatch({ type: "closeOtherTabs", tabId: focusedIsland(before).selectedTabId });
  expect(useWorkspaceStore.getState().notice?.label).toBe("Other tabs closed");
  dispatch({ type: "openTab", href: "/four" });
  expect(useWorkspaceStore.getState().notice?.label).toBe("Other tabs closed");
  undoLayout();
  expect(focusedIsland(getWorkspace()).tabs.map((tab) => tab.href)).toEqual([
    "/",
    "/two",
    "/three",
    "/four",
  ]);
  expect(getWorkspace().closed).toEqual([]);
});

test("pins, opens, jumps and side openings are not undoable", () => {
  dispatch({ type: "openTab", href: "/two" });
  dispatch({ type: "pinTab", tabId: focusedIsland(getWorkspace()).selectedTabId, pinned: true });
  dispatch({ type: "openOrJump", href: "/three" });
  dispatch({ type: "openOrJump", href: "/two" });
  dispatch({ type: "openToSide", href: "/four" });
  expect(useWorkspaceStore.getState().undo).toEqual([]);
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
  undoLayout();
  expect(getWorkspace()).toEqual(before);
});
