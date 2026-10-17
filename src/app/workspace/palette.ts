import { getTabMeta } from "@/app/lib/tabMeta";
import { type DockSource, type DockTarget, reorderTargets } from "@/app/workspace/docking";
import { layoutGeometry } from "@/app/workspace/geometry";
import {
  focusedIsland,
  hrefPathname,
  islands,
  selectedTab,
  type Workspace,
  type WorkspaceCommand,
} from "@/app/workspace/model";

export type WorkspacePaletteCommand = {
  id: string;
  label: string;
  keywords: string[];
  shortcut?: string;
  disabled?: boolean;
  command: WorkspaceCommand | { type: "undo" };
};

/** Palette destinations use the same named commands as the tab and island menus. */
export function buildWorkspaceCommands(
  workspace: Workspace,
  size: { width: number; height: number },
  canUndo: boolean,
): WorkspacePaletteCommand[] {
  const all = islands(workspace.layout);
  const from = focusedIsland(workspace);
  const tab = selectedTab(from);
  const entries: WorkspacePaletteCommand[] = [];
  const add = (
    id: string,
    label: string,
    command: WorkspacePaletteCommand["command"],
    disabled = false,
    shortcut?: string,
  ) =>
    entries.push({
      id: `layout:${id}`,
      label,
      command,
      disabled,
      shortcut,
      keywords: [
        "layout",
        "workspace",
        ...(command.type === "dock"
          ? ["dock", "move", command.target.type === "tabs" ? "merge" : "split"]
          : []),
        ...(command.type === "equalizeSplit" ? ["resize", "gap", "balance"] : []),
      ],
    });
  const name = (href: string) => {
    const meta = getTabMeta(hrefPathname(href));
    return [meta.label, meta.sublabel].filter(Boolean).join(" · ");
  };
  const islandName = (index: number) =>
    `island ${index + 1} · ${name(selectedTab(all[index]!).href)}`;
  const tabSource: DockSource = { type: "tab", tabId: tab.id };
  const islandSource: DockSource = { type: "island", islandId: from.id };
  const dock = (
    id: string,
    label: string,
    source: DockSource,
    target: DockTarget,
    disabled = false,
  ) => add(id, label, { type: "dock", source, target }, disabled);

  const pinned = from.pinned.includes(tab.id);
  add("pin", `${pinned ? "Unpin" : "Pin"} focused tab`, {
    type: "pinTab",
    tabId: tab.id,
    pinned: !pinned,
  });
  add("duplicate", "Duplicate focused tab", { type: "duplicateTab", tabId: tab.id });
  add("close-tab", "Close focused tab", { type: "closeTab", tabId: tab.id }, false, "Alt W");
  add("close-others", "Close other tabs", { type: "closeOtherTabs", tabId: tab.id });
  add("close-right", "Close tabs to the right", { type: "closeTabsToRight", tabId: tab.id });
  add(
    "reopen",
    "Reopen closed tab",
    { type: "reopenClosedTab" },
    workspace.closed.length === 0,
    "Alt Shift T",
  );
  add("previous", "Select previous tab", { type: "cycleTab", delta: -1 }, false, "Alt [");
  add("next", "Select next tab", { type: "cycleTab", delta: 1 }, false, "Alt ]");
  add("split-right", "Split island right", { type: "splitIsland", side: "right" }, false, "Alt \\");
  add("split-down", "Split island down", { type: "splitIsland", side: "bottom" });
  add(
    "maximize",
    workspace.maximizedIslandId ? "Restore island layout" : "Maximize focused island",
    { type: "toggleMaximize", islandId: from.id },
    all.length < 2,
  );
  add(
    "close-island",
    "Close focused island",
    { type: "closeIsland", islandId: from.id },
    all.length < 2,
  );
  add("undo", "Undo layout change", { type: "undo" }, !canUndo, "⌘ Z");
  add("reset", "Reset layout", { type: "resetLayout" });
  for (const direction of ["left", "right", "up", "down"] as const) {
    add(
      `focus-${direction}`,
      `Focus island ${direction}`,
      { type: "focusNeighbour", direction },
      all.length < 2,
      `Alt Shift ${direction === "up" ? "↑" : direction === "down" ? "↓" : direction === "left" ? "←" : "→"}`,
    );
  }

  for (const { position, target, disabled } of reorderTargets(workspace, tab.id)) {
    dock(`reorder-${position}`, `Move focused tab ${position}`, tabSource, target, disabled);
  }

  all.forEach((island, i) => {
    const destination = islandName(i);
    add(
      `focus:${island.id}`,
      `Focus ${destination}`,
      { type: "focusIsland", islandId: island.id },
      island.id === from.id,
    );
    island.tabs.forEach((item, n) => {
      add(`select:${item.id}`, `Select tab ${n + 1} in ${destination} · ${name(item.href)}`, {
        type: "selectTab",
        tabId: item.id,
      });
    });
    if (island.id !== from.id) {
      for (const [kind, source, verb] of [
        ["tab", tabSource, "Move focused tab to"],
        ["island", islandSource, "Merge focused island into"],
      ] as const) {
        dock(`${kind}:into:${island.id}:end`, `${verb} ${destination} · at end`, source, {
          type: "tabs",
          islandId: island.id,
          index: island.tabs.length,
        });
        island.tabs.forEach((item, n) => {
          dock(
            `${kind}:into:${island.id}:${item.id}`,
            `${verb} ${destination} · before tab ${n + 1}: ${name(item.href)}`,
            source,
            { type: "tabs", islandId: island.id, index: n },
          );
        });
      }
    }
    for (const side of ["left", "right", "top", "bottom"] as const) {
      dock(
        `tab:beside:${island.id}:${side}`,
        `Dock focused tab at ${destination} ${side} edge`,
        tabSource,
        { type: "island-edge", islandId: island.id, side },
        island.id === from.id && from.tabs.length < 2,
      );
      if (island.id !== from.id)
        dock(
          `island:beside:${island.id}:${side}`,
          `Move focused island to ${destination} ${side} edge`,
          islandSource,
          { type: "island-edge", islandId: island.id, side },
        );
    }
  });
  for (const side of ["left", "right", "bottom"] as const) {
    dock(
      `tab:window:${side}`,
      `Dock focused tab at window ${side} edge`,
      tabSource,
      { type: "workspace-edge", side },
      all.length === 1 && from.tabs.length < 2,
    );
    dock(
      `island:window:${side}`,
      `Move focused island to window ${side} edge`,
      islandSource,
      { type: "workspace-edge", side },
      all.length === 1,
    );
  }

  // Use the actual layout extent, including nested splits, so palette resizing
  // has exactly the same minimum-size constraints as dragging its separator.
  const geometry = layoutGeometry(workspace.layout, { left: 0, top: 0, ...size });
  const splitIds = [...new Set(geometry.gaps.map((gap) => gap.splitId))];
  geometry.gaps.forEach((gap, i) => {
    const [start, end] = gap.direction === "row" ? ["left", "right"] : ["up", "down"];
    for (const [label, delta] of [
      [start, -16],
      [end, 16],
      [`${start} by 64 px`, -64],
      [`${end} by 64 px`, 64],
      [`to ${start} limit`, "start"],
      [`to ${end} limit`, "end"],
    ] as const) {
      add(
        `gap:${gap.splitId}:${gap.index}:${delta}`,
        `Resize gap ${i + 1} ${label}`,
        {
          type: "resizeGap",
          splitId: gap.splitId,
          gap: gap.index,
          delta,
          extent: gap.extent,
        },
        gap.extent <= 0,
      );
    }
  });
  splitIds.forEach((splitId, i) => {
    add(`equalize:${splitId}`, `Equalize split ${i + 1}`, { type: "equalizeSplit", splitId });
  });
  return entries;
}
