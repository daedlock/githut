import {
  type Direction,
  focusedIsland,
  islands,
  neighbourIsland,
  pathTo,
  selectedTab,
  type Workspace,
  type WorkspaceCommand,
} from "@/app/workspace/model";
import { dispatch, redoLayout, undoLayout } from "@/app/workspace/store";

/** What a palette entry does: a named workspace command, or undo/redo of the layout. */
export type WorkspacePaletteAction = WorkspaceCommand | "undo" | "redo";

export type WorkspacePaletteCommand = {
  id: string;
  label: string;
  keywords: string[];
  shortcut?: string;
  disabled?: boolean;
  command: WorkspacePaletteAction;
};

const DIRECTIONS: { direction: Direction; word: string; key: string }[] = [
  { direction: "left", word: "left", key: "←" },
  { direction: "right", word: "right", key: "→" },
  { direction: "up", word: "above", key: "↑" },
  { direction: "down", word: "below", key: "↓" },
];

/**
 * A small, fixed set of layout commands for the focused tab and island. It
 * never lists one entry per tab, island or gap: precise targets belong to
 * the tab and island menus and to dragging, resizing to the gaps.
 * `allowed` reports whether a command fits the current room (see
 * `previewCommand`); commands that don't are disabled.
 */
export function buildWorkspaceCommands(
  workspace: Workspace,
  {
    canUndo,
    canRedo,
    allowed = () => true,
  }: { canUndo: boolean; canRedo: boolean; allowed?: (cmd: WorkspaceCommand) => boolean },
): WorkspacePaletteCommand[] {
  const all = islands(workspace.layout);
  const from = focusedIsland(workspace);
  const tab = selectedTab(from);
  const entries: WorkspacePaletteCommand[] = [];
  const add = (
    id: string,
    label: string,
    command: WorkspacePaletteAction,
    {
      disabled = false,
      shortcut,
      keywords = [],
    }: { disabled?: boolean; shortcut?: string; keywords?: string[] } = {},
  ) =>
    entries.push({
      id: `layout:${id}`,
      label,
      command,
      disabled: disabled || (typeof command === "object" && !allowed(command)),
      shortcut,
      keywords: ["layout", "workspace", ...keywords],
    });

  const pinned = from.pinned.includes(tab.id);
  const index = from.tabs.findIndex((item) => item.id === tab.id);
  // Pins stay before ordinary tabs, so a tab moves only within its own group.
  const [first, last] = pinned
    ? [0, from.pinned.length - 1]
    : [from.pinned.length, from.tabs.length - 1];

  add("pin", `${pinned ? "Unpin" : "Pin"} focused tab`, {
    type: "pinTab",
    tabId: tab.id,
    pinned: !pinned,
  });
  add("duplicate", "Duplicate focused tab", { type: "duplicateTab", tabId: tab.id });
  add("close-tab", "Close focused tab", { type: "closeTab", tabId: tab.id }, { shortcut: "Alt W" });
  add("close-others", "Close other tabs", { type: "closeOtherTabs", tabId: tab.id });
  add("close-right", "Close tabs to the right", { type: "closeTabsToRight", tabId: tab.id });
  add(
    "reopen",
    "Reopen closed tab",
    { type: "reopenClosedTab" },
    { disabled: workspace.closed.length === 0, shortcut: "Alt Shift T" },
  );
  add("previous", "Select previous tab", { type: "cycleTab", delta: -1 }, { shortcut: "Alt [" });
  add("next", "Select next tab", { type: "cycleTab", delta: 1 }, { shortcut: "Alt ]" });
  add(
    "reorder-left",
    "Move focused tab left",
    {
      type: "dock",
      source: { type: "tab", tabId: tab.id },
      target: { type: "tabs", islandId: from.id, index: index - 1 },
    },
    { disabled: index <= first, keywords: ["reorder"] },
  );
  add(
    "reorder-right",
    "Move focused tab right",
    {
      type: "dock",
      source: { type: "tab", tabId: tab.id },
      target: { type: "tabs", islandId: from.id, index: index + 2 },
    },
    { disabled: index >= last, keywords: ["reorder"] },
  );
  for (const side of ["right", "bottom"] as const) {
    add(
      `tab-new-island-${side}`,
      `Move focused tab to new island ${side === "right" ? "right" : "below"}`,
      {
        type: "dock",
        source: { type: "tab", tabId: tab.id },
        target: { type: "island-edge", islandId: from.id, side },
      },
      { disabled: from.tabs.length < 2, keywords: ["split", "dock"] },
    );
  }
  for (const { direction, word } of DIRECTIONS) {
    const beside = neighbourIsland(workspace.layout, from.id, direction);
    if (!beside) continue;
    add(
      `tab-to-${direction}`,
      `Move focused tab to island ${word}`,
      {
        type: "dock",
        source: { type: "tab", tabId: tab.id },
        target: { type: "tabs", islandId: beside, index: Number.MAX_SAFE_INTEGER },
      },
      { keywords: ["dock"] },
    );
  }

  add(
    "split-right",
    "Split island right",
    { type: "splitIsland", side: "right" },
    { shortcut: "Alt \\" },
  );
  add("split-down", "Split island down", { type: "splitIsland", side: "bottom" });
  for (const { direction, word, key } of DIRECTIONS) {
    const beside = neighbourIsland(workspace.layout, from.id, direction);
    if (!beside) continue;
    add(
      `focus-${direction}`,
      `Focus island ${word}`,
      { type: "focusNeighbour", direction },
      { shortcut: `Alt Shift ${key}` },
    );
    add(
      `merge-${direction}`,
      `Merge focused island into island ${word}`,
      {
        type: "dock",
        source: { type: "island", islandId: from.id },
        target: { type: "tabs", islandId: beside, index: Number.MAX_SAFE_INTEGER },
      },
      { keywords: ["dock", "combine"] },
    );
  }
  add(
    "maximize",
    workspace.maximizedIslandId ? "Restore island layout" : "Maximize focused island",
    { type: "toggleMaximize", islandId: from.id },
    { disabled: all.length < 2 },
  );
  const parent = pathTo(workspace.layout, from.id).at(-2);
  if (parent)
    add(
      "equalize",
      "Equalize island sizes",
      { type: "equalizeSplit", splitId: parent },
      { keywords: ["resize", "balance"] },
    );
  add(
    "close-island",
    "Close focused island",
    { type: "closeIsland", islandId: from.id },
    { disabled: all.length < 2 },
  );
  add("undo", "Undo layout change", "undo", { disabled: !canUndo, shortcut: "⌘ Z" });
  add("redo", "Redo layout change", "redo", {
    disabled: !canRedo,
    shortcut: "⌘ Shift Z",
  });
  add("reset", "Reset layout", { type: "resetLayout" }, { disabled: all.length < 2 });
  return entries;
}

export function runWorkspacePaletteCommand(command: WorkspacePaletteAction) {
  if (command === "undo") undoLayout();
  else if (command === "redo") redoLayout();
  else dispatch(command);
}
