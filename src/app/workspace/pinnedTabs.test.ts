import { expect, test } from "bun:test";
import { createWorkspace, focusedIsland, focusedTab, islands, runCommand } from "./model";

test("pinning keeps tabs first without changing the selected page", () => {
  let ws = createWorkspace(["/one", "/two", "/three"], 0);
  const [one, two, three] = focusedIsland(ws).tabs;
  ws = runCommand(ws, { type: "pinTab", tabId: three!.id, pinned: true });
  ws = runCommand(ws, { type: "pinTab", tabId: two!.id, pinned: true });
  expect(focusedIsland(ws).tabs.map((tab) => tab.href)).toEqual(["/three", "/two", "/one"]);
  expect(focusedIsland(ws).pinned).toEqual([three!.id, two!.id]);
  expect(focusedTab(ws).id).toBe(one!.id);

  ws = runCommand(ws, { type: "pinTab", tabId: three!.id, pinned: false });
  expect(focusedIsland(ws).tabs.map((tab) => tab.href)).toEqual(["/two", "/three", "/one"]);
});

test("moving a pinned tab carries its pin and keeps it before ordinary tabs", () => {
  let ws = createWorkspace(["/pin", "/ordinary"]);
  const pin = focusedIsland(ws).tabs[0]!;
  ws = runCommand(ws, { type: "pinTab", tabId: pin.id, pinned: true });
  ws = runCommand(ws, { type: "splitIsland", side: "right" });
  const destination = focusedIsland(ws).id;
  ws = runCommand(ws, { type: "moveTab", tabId: pin.id, islandId: destination, index: 1 });
  expect(focusedIsland(ws).pinned).toEqual([pin.id]);
  expect(focusedIsland(ws).tabs[0]!.id).toBe(pin.id);
  expect(islands(ws.layout)[0]!.pinned).toEqual([]);
});

test("bulk close keeps pins, including pins to the right of another pinned tab", () => {
  let ws = createWorkspace(["/one", "/two", "/three", "/four"]);
  const [one, two, three] = focusedIsland(ws).tabs;
  ws = runCommand(ws, { type: "pinTab", tabId: one!.id, pinned: true });
  ws = runCommand(ws, { type: "pinTab", tabId: three!.id, pinned: true });
  const others = runCommand(ws, { type: "closeOtherTabs", tabId: two!.id });
  expect(focusedIsland(others).tabs.map((tab) => tab.href)).toEqual(["/one", "/three", "/two"]);
  expect(others.closed).toEqual(["/four"]);
  const right = runCommand(ws, { type: "closeTabsToRight", tabId: one!.id });
  expect(focusedIsland(right).tabs.map((tab) => tab.href)).toEqual(["/one", "/three"]);
  expect(right.closed).toEqual(["/two", "/four"]);
});
