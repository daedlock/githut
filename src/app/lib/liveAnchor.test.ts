import { expect, test } from "bun:test";
import { commitMeasure } from "@/app/lib/liveAnchor";

test("new content while the reader is on a laid-out page keeps their place", () => {
  expect(commitMeasure("settled", { previousReady: true, childrenChanged: true })).toBe(
    "keep-place",
  );
});

test("the first load arriving only re-captures the anchor, after paint", () => {
  expect(commitMeasure("settled", { previousReady: false, childrenChanged: true })).toBe(
    "recapture",
  );
});

test("a commit that did not change the content measures nothing", () => {
  expect(commitMeasure("settled", { previousReady: true, childrenChanged: false })).toBe("none");
});

test("a background tab, or one just revealed and not yet laid out, never measures in commit", () => {
  for (const pane of ["hidden", "revealed"] as const) {
    expect(commitMeasure(pane, { previousReady: true, childrenChanged: true })).toBe("none");
    expect(commitMeasure(pane, { previousReady: false, childrenChanged: true })).toBe("none");
  }
});
