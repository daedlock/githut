import { expect, test } from "bun:test";
import { createWorkspace, focusedIsland, focusedTab, islands, runCommand } from "./model";
import { keepAliveTabs } from "./tabLifetime";

test("the eight most recent tabs and older pins stay mounted without closing older pages", () => {
  let ws = createWorkspace(["/pin", "/old", "/2", "/3", "/4", "/5", "/6", "/7", "/8", "/9"], 9);
  const tabs = focusedIsland(ws).tabs;
  ws = runCommand(ws, { type: "pinTab", tabId: tabs[0]!.id, pinned: true });
  const recent = tabs
    .slice(1)
    .reverse()
    .map((tab) => tab.id);
  const mounted = keepAliveTabs(ws.layout, recent);
  expect(tabs.filter((tab) => mounted.has(tab.id)).map((tab) => tab.href)).toEqual([
    "/pin",
    "/2",
    "/3",
    "/4",
    "/5",
    "/6",
    "/7",
    "/8",
    "/9",
  ]);
  expect(focusedIsland(ws).tabs).toHaveLength(10);

  ws = runCommand(ws, { type: "selectTab", tabId: tabs[1]!.id });
  const revisited = keepAliveTabs(ws.layout, [tabs[1]!.id, ...recent]);
  expect(revisited.has(tabs[1]!.id)).toBe(true);
  expect(revisited.has(tabs[2]!.id)).toBe(false);
});

test("focusing another island keeps the same mounted set, so no island re-renders its panes", () => {
  let ws = runCommand(createWorkspace(["/one", "/two"]), { type: "splitIsland", side: "right" });
  const [left, right] = islands(ws.layout);
  const before = keepAliveTabs(ws.layout, [focusedTab(ws).id]);
  ws = runCommand(ws, {
    type: "focusIsland",
    islandId: (focusedIsland(ws).id === left!.id ? right : left)!.id,
  });
  const after = keepAliveTabs(ws.layout, [focusedTab(ws).id, ...before], undefined, before);
  expect(after).toBe(before);

  // A tab that comes or goes yields a new set.
  ws = runCommand(ws, { type: "openTab", href: "/three" });
  const grown = keepAliveTabs(ws.layout, [focusedTab(ws).id, ...after], undefined, after);
  expect(grown).not.toBe(after);
  expect(grown.size).toBe(after.size + 1);
});
