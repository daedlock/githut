import { beforeEach, expect, test } from "bun:test";
import { createWorkspace, focusedIsland, islands } from "@/app/workspace/model";
import { buildWorkspaceCommands } from "@/app/workspace/palette";
import { dispatch, getWorkspace, useWorkspaceStore } from "@/app/workspace/store";

beforeEach(() =>
  useWorkspaceStore.setState({
    workspace: createWorkspace(["/a", "/b", "/c"]),
    undo: [],
    notice: null,
  }),
);

function choose(label: string | RegExp) {
  const entry = buildWorkspaceCommands(
    getWorkspace(),
    { width: 1400, height: 900 },
    useWorkspaceStore.getState().undo.length > 0,
  ).find((entry) => (typeof label === "string" ? entry.label === label : label.test(entry.label)));
  expect(entry).toBeDefined();
  expect(entry!.disabled).not.toBe(true);
  dispatch(entry!.command);
}

test("palette tab actions pin, duplicate, close, reopen and preserve pins in bulk closes", () => {
  choose("Pin focused tab");
  const pinned = focusedIsland(getWorkspace()).selectedTabId;
  choose("Duplicate focused tab");
  expect(focusedIsland(getWorkspace()).tabs).toHaveLength(4);
  dispatch({ type: "navigate", tabId: focusedIsland(getWorkspace()).selectedTabId, href: "/d" });
  choose("Close other tabs");
  expect(focusedIsland(getWorkspace()).tabs).toHaveLength(2);
  expect(focusedIsland(getWorkspace()).pinned).toEqual([pinned]);
  choose("Close focused tab");
  choose("Reopen closed tab");
  expect(focusedIsland(getWorkspace()).tabs).toHaveLength(2);
});

test("palette splits, moves tabs to dynamic destinations, moves and merges whole islands, and undoes", () => {
  choose("Split island right");
  const [left, right] = islands(getWorkspace().layout);
  choose(/^Move focused tab to island 1 .*at end$/);
  expect(islands(getWorkspace().layout)).toHaveLength(1);
  choose("Undo layout change");
  expect(islands(getWorkspace().layout).map((i) => i.id)).toEqual([left!.id, right!.id]);
  choose("Move focused island to window left edge");
  expect(islands(getWorkspace().layout)[0]?.id).toBe(right!.id);
  choose(/^Merge focused island into island 2 .*at end$/);
  expect(islands(getWorkspace().layout)).toHaveLength(1);
  choose("Undo layout change");
  choose(/^Focus island 2 /);
  expect(getWorkspace().focusedIslandId).toBe(left!.id);
});

test("palette gap resizing uses the real extent, equalizes, maximizes, restores, and resets without losing tabs", () => {
  choose("Split island right");
  choose("Resize gap 1 left");
  const resized = getWorkspace().layout;
  expect(resized.kind === "split" && resized.sizes[0]).toBeLessThan(0.5);
  choose("Equalize split 1");
  const equalized = getWorkspace().layout;
  expect(equalized.kind === "split" && equalized.sizes).toEqual([0.5, 0.5]);
  choose("Maximize focused island");
  expect(getWorkspace().maximizedIslandId).toBe(getWorkspace().focusedIslandId);
  choose("Restore island layout");
  expect(getWorkspace().maximizedIslandId).toBeNull();
  const ids = islands(getWorkspace().layout).flatMap((i) => i.tabs.map((t) => t.id));
  choose("Reset layout");
  expect(
    focusedIsland(getWorkspace())
      .tabs.map((t) => t.id)
      .sort(),
  ).toEqual(ids.sort());
  choose("Undo layout change");
  choose("Close focused island");
  expect(islands(getWorkspace().layout)).toHaveLength(1);
});
