import { beforeEach, expect, test } from "bun:test";
import { createWorkspace, focusedIsland, islands } from "@/app/workspace/model";
import { buildWorkspaceCommands, runWorkspacePaletteCommand } from "@/app/workspace/palette";
import { getWorkspace, useWorkspaceStore } from "@/app/workspace/store";

beforeEach(() =>
  useWorkspaceStore.setState({
    workspace: createWorkspace(["/a", "/b", "/c"]),
    undo: [],
    redo: [],
    notice: null,
  }),
);

function commands() {
  const { workspace, undo, redo } = useWorkspaceStore.getState();
  return buildWorkspaceCommands(workspace, { canUndo: undo.length > 0, canRedo: redo.length > 0 });
}

function choose(label: string | RegExp) {
  const entry = commands().find((entry) =>
    typeof label === "string" ? entry.label === label : label.test(entry.label),
  );
  expect(entry).toBeDefined();
  expect(entry!.disabled).not.toBe(true);
  runWorkspacePaletteCommand(entry!.command);
}

test("palette tab actions pin, duplicate, close, reopen and preserve pins in bulk closes", () => {
  choose("Pin focused tab");
  const pinned = focusedIsland(getWorkspace()).selectedTabId;
  choose("Duplicate focused tab");
  expect(focusedIsland(getWorkspace()).tabs).toHaveLength(4);
  runWorkspacePaletteCommand({
    type: "navigate",
    tabId: focusedIsland(getWorkspace()).selectedTabId,
    href: "/d",
  });
  choose("Close other tabs");
  expect(focusedIsland(getWorkspace()).tabs).toHaveLength(2);
  expect(focusedIsland(getWorkspace()).pinned).toEqual([pinned]);
  choose("Close focused tab");
  choose("Reopen closed tab");
  expect(focusedIsland(getWorkspace()).tabs).toHaveLength(2);
});

test("palette splits, moves tabs to neighbouring islands, merges islands, undoes and redoes", () => {
  choose("Split island right");
  const [left, right] = islands(getWorkspace().layout);
  choose("Move focused tab to island left");
  expect(islands(getWorkspace().layout)).toHaveLength(1);
  choose("Undo layout change");
  expect(islands(getWorkspace().layout).map((i) => i.id)).toEqual([left!.id, right!.id]);
  choose("Redo layout change");
  expect(islands(getWorkspace().layout)).toHaveLength(1);
  choose("Undo layout change");
  choose("Merge focused island into island left");
  expect(islands(getWorkspace().layout)).toHaveLength(1);
  choose("Undo layout change");
  choose("Focus island left");
  expect(getWorkspace().focusedIslandId).toBe(left!.id);
});

test("palette lists a fixed set of layout commands, whatever the number of tabs", () => {
  const few = commands().length;
  for (const href of ["/d", "/e", "/f", "/g", "/h"])
    runWorkspacePaletteCommand({ type: "openTab", href });
  expect(commands().length).toBe(few);
  expect(commands().some((entry) => /tab \d|gap \d/i.test(entry.label))).toBe(false);
});

test("palette equalizes, maximizes, restores, and resets without losing tabs", () => {
  choose("Split island right");
  const split = getWorkspace().layout;
  runWorkspacePaletteCommand({
    type: "resizeGap",
    splitId: split.id,
    gap: 0,
    delta: -100,
    extent: 1400,
  });
  choose("Equalize island sizes");
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
