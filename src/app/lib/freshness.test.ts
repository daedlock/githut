import { afterEach, expect, test } from "bun:test";
import { CADENCE, freshnessLevel, liveInterval } from "@/app/lib/freshness";
import {
  bucketBackoff,
  clearRateLimit,
  getRateBackoff,
  noticeUntil,
  recordRateLimit,
  useRateLimitStore,
} from "@/app/stores/rateLimit";
import { createWorkspace, focusedTab, islands, runCommand } from "@/app/workspace/model";

afterEach(() => clearRateLimit());

test("a tab's level follows the workspace: focused, visible beside it, background otherwise", () => {
  let workspace = runCommand(createWorkspace(["/one", "/two"]), {
    type: "splitIsland",
    side: "right",
  });
  const [left, right] = islands(workspace.layout);
  const focused = focusedTab(workspace).id;
  const other = (focused === left!.selectedTabId ? right : left)!.selectedTabId;
  expect(freshnessLevel(workspace, false, focused)).toBe("focused");
  expect(freshnessLevel(workspace, false, other)).toBe("visible");
  // Narrow mode renders only the focused island.
  expect(freshnessLevel(workspace, true, other)).toBe("background");
  const hidden = islands(workspace.layout)
    .flatMap((island) => island.tabs)
    .find((tab) => tab.id !== focused && tab.id !== other);
  if (hidden) expect(freshnessLevel(workspace, false, hidden.id)).toBe("background");
  workspace = runCommand(workspace, {
    type: "focusIsland",
    islandId: (focused === left!.selectedTabId ? right : left)!.id,
  });
  expect(freshnessLevel(workspace, false, other)).toBe("focused");
});

test("only live queries poll: 15s focused, 60s visible, 3s running CI, never faster than the hook's floor", () => {
  expect(liveInterval("focused", false)).toBe(false);
  expect(liveInterval("focused", "changing")).toBe(CADENCE.focused);
  expect(liveInterval("visible", "changing")).toBe(CADENCE.visible);
  expect(liveInterval("visible", "ci")).toBe(CADENCE.ci);
  expect(liveInterval("focused", "ci", { floor: 10_000 })).toBe(10_000);
  expect(liveInterval("focused", "changing", { floor: 60_000 })).toBe(60_000);
  expect(liveInterval("background", "ci")).toBe(false);
});

test("a low bucket slows only its own queries 4x and an empty one pauses them until reset", () => {
  const reset = Math.floor(Date.now() / 1000) + 600;
  const headers = (resource: string, remaining: number) =>
    new Headers({
      "x-ratelimit-resource": resource,
      "x-ratelimit-limit": resource === "search" ? "30" : "5000",
      "x-ratelimit-remaining": String(remaining),
      "x-ratelimit-reset": String(reset),
    });
  recordRateLimit(headers("search", 2));
  expect(getRateBackoff("search")).toBe(4);
  expect(getRateBackoff("core")).toBe(1);
  // Search alone never raises the "Updates slowed" notice.
  expect(noticeUntil(useRateLimitStore.getState().buckets)).toBe(0);
  recordRateLimit(headers("graphql", 0));
  expect(getRateBackoff("graphql")).toBe(Infinity);
  expect(noticeUntil(useRateLimitStore.getState().buckets)).toBe(reset * 1000);
  const backoff = bucketBackoff(useRateLimitStore.getState().buckets.graphql);
  expect(liveInterval("focused", "changing", { backoff })).toBe(false);
  expect(liveInterval("focused", "changing", { backoff: getRateBackoff("search") })).toBe(60_000);
  // A fresh window clears the bucket.
  recordRateLimit(headers("graphql", 4000));
  expect(getRateBackoff("graphql")).toBe(1);
});
