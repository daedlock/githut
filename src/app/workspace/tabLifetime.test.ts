import { expect, test } from "bun:test";
import { createWorkspace, focusedIsland, runCommand } from "./model";
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
