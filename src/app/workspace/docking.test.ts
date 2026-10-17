import { expect, test } from "bun:test";
import {
  createWorkspace,
  focusedIsland,
  islands,
  newIsland,
  newSplit,
  runCommand,
} from "@/app/workspace/model";

test("docking a tab between its neighbours preserves its identity and exact insertion point", () => {
  const workspace = createWorkspace(["/one", "/two", "/three"]);
  const island = focusedIsland(workspace);
  const moved = runCommand(workspace, {
    type: "dock",
    source: { type: "tab", tabId: island.tabs[0]!.id },
    target: { type: "tabs", islandId: island.id, index: 2 },
  });
  expect(focusedIsland(moved).tabs).toEqual([island.tabs[1]!, island.tabs[0]!, island.tabs[2]!]);
});

test("moving a whole island keeps its selection and pins when merged at an exact tab gap", () => {
  const left = newIsland(["/one", "/two"]);
  const right = newIsland(["/pin", "/four", "/five"], 2);
  right.pinned = [right.tabs[0]!.id];
  const workspace = {
    ...createWorkspace(["/"]),
    layout: newSplit("row", [left, right]),
    focusedIslandId: right.id,
  };
  const moved = runCommand(workspace, {
    type: "dock",
    source: { type: "island", islandId: right.id },
    target: { type: "tabs", islandId: left.id, index: 1 },
  });
  expect(islands(moved.layout)).toHaveLength(1);
  expect(focusedIsland(moved).tabs.map((tab) => tab.href)).toEqual([
    "/pin",
    "/one",
    "/four",
    "/five",
    "/two",
  ]);
  expect(focusedIsland(moved).selectedTabId).toBe(right.selectedTabId);
  expect(focusedIsland(moved).pinned).toEqual([right.tabs[0]!.id]);
});

test("docking at each island edge places the moved tab on that side without duplicating it", () => {
  for (const side of ["left", "right", "top", "bottom"] as const) {
    const workspace = createWorkspace(["/one", "/two"]);
    const from = focusedIsland(workspace);
    const moved = runCommand(workspace, {
      type: "dock",
      source: { type: "tab", tabId: from.tabs[1]!.id },
      target: { type: "island-edge", islandId: from.id, side },
    });
    expect(moved.layout.kind).toBe("split");
    if (moved.layout.kind !== "split") throw new Error("Expected split");
    expect(moved.layout.direction).toBe(side === "left" || side === "right" ? "row" : "column");
    expect(islands(moved.layout).map((island) => island.tabs[0]!.href)).toEqual(
      side === "left" || side === "top" ? ["/two", "/one"] : ["/one", "/two"],
    );
    expect(focusedIsland(moved).tabs[0]!.id).toBe(from.tabs[1]!.id);
  }
});

test("window docking spans the workspace after removing and normalizing the source island", () => {
  const first = newIsland(["/one"]);
  const second = newIsland(["/two"]);
  const third = newIsland(["/three"]);
  const workspace = {
    ...createWorkspace(["/"]),
    layout: newSplit("row", [newSplit("column", [first, second]), third]),
    focusedIslandId: first.id,
  };
  const moved = runCommand(workspace, {
    type: "dock",
    source: { type: "island", islandId: first.id },
    target: { type: "workspace-edge", side: "bottom" },
  });
  expect(moved.layout.kind).toBe("split");
  if (moved.layout.kind !== "split") throw new Error("Expected split");
  expect(moved.layout.direction).toBe("column");
  expect(moved.layout.children[1]).toBe(first);
  expect(islands(moved.layout.children[0]!).map((island) => island.id)).toEqual([
    second.id,
    third.id,
  ]);
  expect(moved.layout.sizes).toEqual([0.5, 0.5]);
});
