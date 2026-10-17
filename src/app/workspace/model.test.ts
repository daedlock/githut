import { describe, expect, test } from "bun:test";
import {
  createWorkspace,
  focusedIsland,
  focusedTab,
  normalizeHref,
  runCommand,
  type Workspace,
} from "@/app/workspace/model";

// The tab strip's tests, carried over to the workspace model: commands in,
// workspace out, with every tab in one island.

const hrefs = (ws: Workspace) => focusedIsland(ws).tabs.map((t) => t.href);
const selectedHref = (ws: Workspace) => focusedTab(ws).href;
const tabId = (ws: Workspace, i: number) => focusedIsland(ws).tabs[i]!.id;

/** One island with a tab per href; `selected` is the selected index. */
function withTabs(list: string[], selected = 0): Workspace {
  return createWorkspace(list, selected);
}

describe("workspace model (single island)", () => {
  test("navigation re-points the tab instead of opening new ones", () => {
    let ws = withTabs(["/a/b/pulls"]);
    ws = runCommand(ws, { type: "navigate", tabId: tabId(ws, 0), href: "/a/b/pull/1" });
    expect(hrefs(ws)).toEqual(["/a/b/pull/1"]);
    expect(selectedHref(ws)).toBe("/a/b/pull/1");
  });

  test("openTab inserts right after the selected tab and selects it", () => {
    const ws = runCommand(withTabs(["/x", "/y"], 0), { type: "openTab", href: "/z" });
    expect(hrefs(ws)).toEqual(["/x", "/z", "/y"]);
    expect(selectedHref(ws)).toBe("/z");
  });

  test("openTab can open in the background", () => {
    const ws = runCommand(withTabs(["/x"]), { type: "openTab", href: "/z", select: false });
    expect(hrefs(ws)).toEqual(["/x", "/z"]);
    expect(selectedHref(ws)).toBe("/x");
  });

  test("openTab reuses a tab in the island already showing the same page", () => {
    const ws = runCommand(withTabs(["/a/b/code", "/a/b/pulls"]), {
      type: "openTab",
      href: "/a/b/pulls?state=closed",
    });
    expect(hrefs(ws)).toEqual(["/a/b/code", "/a/b/pulls?state=closed"]);
    expect(selectedHref(ws)).toBe("/a/b/pulls?state=closed");
  });

  test("allowDuplicate opens a second copy", () => {
    const ws = runCommand(withTabs(["/x"]), { type: "openTab", href: "/x", allowDuplicate: true });
    expect(hrefs(ws)).toEqual(["/x", "/x"]);
  });

  test("closing the selected tab selects the right neighbour, then the left", () => {
    const ws = withTabs(["/1", "/2", "/3"], 1);
    expect(selectedHref(runCommand(ws, { type: "closeTab", tabId: tabId(ws, 1) }))).toBe("/3");
    const last = withTabs(["/1", "/2", "/3"], 2);
    expect(selectedHref(runCommand(last, { type: "closeTab", tabId: tabId(last, 2) }))).toBe("/2");
  });

  test("closing a background tab keeps the selection and records it for reopening", () => {
    const ws = withTabs(["/1", "/2"], 0);
    const next = runCommand(ws, { type: "closeTab", tabId: tabId(ws, 1) });
    expect(selectedHref(next)).toBe("/1");
    expect(next.closed).toEqual(["/2"]);
  });

  test("the last tab can't be closed", () => {
    const ws = withTabs(["/1"]);
    expect(runCommand(ws, { type: "closeTab", tabId: tabId(ws, 0) })).toBe(ws);
  });

  test("close others / close to the right", () => {
    const ws = withTabs(["/1", "/2", "/3", "/4"], 3);
    const others = runCommand(ws, { type: "closeOtherTabs", tabId: tabId(ws, 1) });
    expect(hrefs(others)).toEqual(["/2"]);
    expect(selectedHref(others)).toBe("/2");

    const right = runCommand(ws, { type: "closeTabsToRight", tabId: tabId(ws, 1) });
    expect(hrefs(right)).toEqual(["/1", "/2"]);
    expect(selectedHref(right)).toBe("/2");
    expect(right.closed).toEqual(["/3", "/4"]);
  });

  test("moveTab reorders within the island", () => {
    const ws = withTabs(["/1", "/2", "/3"]);
    const island = focusedIsland(ws).id;
    const moved = runCommand(ws, {
      type: "moveTab",
      tabId: tabId(ws, 0),
      islandId: island,
      index: 2,
    });
    expect(hrefs(moved)).toEqual(["/2", "/3", "/1"]);
    expect(
      runCommand(ws, { type: "moveTab", tabId: tabId(ws, 0), islandId: island, index: 0 }),
    ).toBe(ws);
  });

  test("navigate updates only that tab", () => {
    const ws = withTabs(["/1", "/2"], 0);
    const next = runCommand(ws, { type: "navigate", tabId: tabId(ws, 1), href: "/2/deeper?x=1" });
    expect(hrefs(next)).toEqual(["/1", "/2/deeper?x=1"]);
    expect(selectedHref(next)).toBe("/1");
    expect(
      runCommand(next, { type: "navigate", tabId: tabId(next, 1), href: "/2/deeper?x=1" }),
    ).toBe(next);
  });

  test("normalizeHref strips origin and trailing slashes", () => {
    expect(normalizeHref("http://localhost:5173/a/b/?x=1#h")).toBe("/a/b?x=1#h");
    expect(normalizeHref("/")).toBe("/");
  });
});
