import { describe, expect, test } from "bun:test";
import {
  closeOthers,
  closeTab,
  closeToRight,
  moveTab,
  normalizeHref,
  openTab,
  setTabHref,
  syncActive,
  type TabsSnapshot,
} from "@/app/stores/tabs";

const empty: TabsSnapshot = { tabs: [], activeId: null, closed: [] };

/** Build a snapshot with one tab per href; the first is active unless stated. */
function withTabs(hrefs: string[], activeIndex = 0): TabsSnapshot {
  let s = syncActive(empty, hrefs[0]!);
  for (const href of hrefs.slice(1)) s = openTab(s, href, { activate: false }).state;
  // openTab inserts after the active tab, so re-order to match `hrefs`.
  s = { ...s, tabs: hrefs.map((h) => s.tabs.find((t) => t.href === h)!) };
  return { ...s, activeId: s.tabs[activeIndex]!.id };
}

const hrefs = (s: TabsSnapshot) => s.tabs.map((t) => t.href);
const activeHref = (s: TabsSnapshot) => s.tabs.find((t) => t.id === s.activeId)?.href;

describe("tabs model", () => {
  test("navigation re-points the active tab instead of opening new ones", () => {
    let s = syncActive(empty, "/a/b/pulls");
    s = syncActive(s, "/a/b/pull/1");
    expect(hrefs(s)).toEqual(["/a/b/pull/1"]);
    expect(activeHref(s)).toBe("/a/b/pull/1");
  });

  test("openTab inserts right after the active tab and focuses it", () => {
    const s = openTab(withTabs(["/x", "/y"], 0), "/z").state;
    expect(hrefs(s)).toEqual(["/x", "/z", "/y"]);
    expect(activeHref(s)).toBe("/z");
  });

  test("openTab can open in the background", () => {
    const s = openTab(withTabs(["/x"]), "/z", { activate: false }).state;
    expect(hrefs(s)).toEqual(["/x", "/z"]);
    expect(activeHref(s)).toBe("/x");
  });

  test("openTab reuses a tab already showing the same page", () => {
    const s = openTab(withTabs(["/a/b/code", "/a/b/pulls"]), "/a/b/pulls?state=closed").state;
    expect(hrefs(s)).toEqual(["/a/b/code", "/a/b/pulls?state=closed"]);
    expect(activeHref(s)).toBe("/a/b/pulls?state=closed");
  });

  test("allowDuplicate opens a second copy", () => {
    const s = openTab(withTabs(["/x"]), "/x", { allowDuplicate: true }).state;
    expect(hrefs(s)).toEqual(["/x", "/x"]);
  });

  test("closing the active tab focuses the right neighbour, then the left", () => {
    const s = withTabs(["/1", "/2", "/3"], 1);
    expect(activeHref(closeTab(s, s.tabs[1]!.id))).toBe("/3");
    const last = withTabs(["/1", "/2", "/3"], 2);
    expect(activeHref(closeTab(last, last.tabs[2]!.id))).toBe("/2");
  });

  test("closing a background tab keeps focus and records it for reopening", () => {
    const s = withTabs(["/1", "/2"], 0);
    const next = closeTab(s, s.tabs[1]!.id);
    expect(activeHref(next)).toBe("/1");
    expect(next.closed).toEqual(["/2"]);
  });

  test("the last tab can't be closed", () => {
    const s = withTabs(["/1"]);
    expect(closeTab(s, s.tabs[0]!.id)).toBe(s);
  });

  test("close others / close to the right", () => {
    const s = withTabs(["/1", "/2", "/3", "/4"], 3);
    const others = closeOthers(s, s.tabs[1]!.id);
    expect(hrefs(others)).toEqual(["/2"]);
    expect(activeHref(others)).toBe("/2");

    const right = closeToRight(s, s.tabs[1]!.id);
    expect(hrefs(right)).toEqual(["/1", "/2"]);
    expect(activeHref(right)).toBe("/2");
    expect(right.closed).toEqual(["/3", "/4"]);
  });

  test("moveTab reorders", () => {
    const s = withTabs(["/1", "/2", "/3"]);
    expect(hrefs(moveTab(s, 0, 2))).toEqual(["/2", "/3", "/1"]);
    expect(moveTab(s, 0, 9)).toBe(s);
  });

  test("setTabHref updates only that tab", () => {
    const s = withTabs(["/1", "/2"], 0);
    const next = setTabHref(s, s.tabs[1]!.id, "/2/deeper?x=1");
    expect(hrefs(next)).toEqual(["/1", "/2/deeper?x=1"]);
    expect(activeHref(next)).toBe("/1");
    expect(setTabHref(next, next.tabs[1]!.id, "/2/deeper?x=1")).toBe(next);
  });

  test("normalizeHref strips origin and trailing slashes", () => {
    expect(normalizeHref("http://localhost:5173/a/b/?x=1#h")).toBe("/a/b?x=1#h");
    expect(normalizeHref("/")).toBe("/");
  });
});
