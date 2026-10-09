import { describe, expect, test } from "bun:test";
import {
  type BulkItem,
  coverage,
  describeAction,
  describeFailure,
  invertJobs,
  planJobs,
  runBulkJobs,
  toBulkItem,
  toggleSelection,
} from "./bulkSelection";

const item = (number: number, patch: Partial<BulkItem> = {}): BulkItem => ({
  number,
  status: "open",
  merged: false,
  labels: [],
  assignees: [],
  ...patch,
});

describe("toggleSelection", () => {
  test("selects and deselects ranges in display order", () => {
    const order = [9, 2, 7, 1];
    expect([...toggleSelection(new Set([9]), order, 2, 0, true)]).toEqual([9, 2, 7]);
    expect([...toggleSelection(new Set(order), order, 1, 3, true)]).toEqual([9]);
  });
  test("ignores missing anchors and deduplicates grouped items", () => {
    expect([...toggleSelection(new Set(), [3, 1, 3, 2], 3, 0, true)]).toEqual([3, 1, 2]);
    expect([...toggleSelection(new Set([3]), [1, 2], 1, -1, true)]).toEqual([3, 2]);
  });
  test("range anchors distinguish repeated rows across groups", () => {
    expect([...toggleSelection(new Set([3]), [3, 1, 3, 2], 3, 2, true)]).toEqual([3, 2]);
  });
});

describe("toBulkItem", () => {
  test("maps list rows, including not-planned issues and merged pull requests", () => {
    expect(
      toBulkItem({
        number: 4,
        state: "closed",
        state_reason: "not_planned",
        labels: [{ name: "bug" }],
        assignees: [{ login: "mira" }, null],
      }),
    ).toEqual({
      number: 4,
      status: "not_planned",
      merged: false,
      labels: ["bug"],
      assignees: ["mira"],
    });
    expect(
      toBulkItem({
        number: 5,
        state: "closed",
        labels: [],
        assignees: [],
        pull_request: { merged_at: "2026-01-01T00:00:00Z" },
      }),
    ).toMatchObject({ status: "closed", merged: true });
  });
});

describe("coverage", () => {
  test("reports all, some, or none", () => {
    const items = [item(1, { labels: ["bug"] }), item(2)];
    expect(coverage(items, (i) => i.labels.includes("bug"))).toBe("some");
    expect(coverage(items, () => true)).toBe("all");
    expect(coverage(items, () => false)).toBe("none");
  });
});

describe("planJobs", () => {
  test("skips items an action would not change, and merged pull requests for status", () => {
    const items = [
      item(1),
      item(2, { status: "closed" }),
      item(3, { status: "closed", merged: true }),
    ];
    expect(planJobs(items, { type: "status", value: "open" })).toEqual([
      {
        number: 2,
        action: { type: "status", value: "open" },
        undo: { type: "status", value: "closed" },
      },
    ]);
  });
  test("adds only where missing and removes only where present", () => {
    const items = [item(1, { labels: ["bug"] }), item(2)];
    expect(
      planJobs(items, { type: "label", value: "bug", add: true }).map((j) => j.number),
    ).toEqual([2]);
    expect(planJobs(items, { type: "label", value: "bug", add: false })).toEqual([
      {
        number: 1,
        action: { type: "label", value: "bug", add: false },
        undo: { type: "label", value: "bug", add: true },
      },
    ]);
  });
  test("compares assignee logins case-insensitively", () => {
    const items = [item(1, { assignees: ["Mira"] }), item(2)];
    expect(
      planJobs(items, { type: "assignee", value: "mira", add: true }).map((j) => j.number),
    ).toEqual([2]);
  });
  test("undo restores each item's own previous status", () => {
    const items = [item(1), item(2, { status: "not_planned" })];
    const jobs = planJobs(items, { type: "status", value: "closed" });
    expect(invertJobs(jobs).map((j) => [j.number, j.action])).toEqual([
      [1, { type: "status", value: "open" }],
      [2, { type: "status", value: "not_planned" }],
    ]);
  });
});

describe("runBulkJobs", () => {
  test("bounds concurrency and reports partial failures", async () => {
    let active = 0;
    let peak = 0;
    const jobs = planJobs(
      [1, 2, 3, 4, 5, 6].map((n) => item(n)),
      {
        type: "label",
        value: "bug",
        add: true,
      },
    );
    const failures = await runBulkJobs(jobs, async (job) => {
      peak = Math.max(peak, ++active);
      await Bun.sleep(2);
      active--;
      if (job.number === 2 || job.number === 5) throw new Error("Permission denied");
    });
    expect(peak).toBe(4);
    expect(failures.map((f) => f.job.number).sort()).toEqual([2, 5]);
    expect(failures[0]?.message).toBe("Permission denied");
  });
});

describe("describe", () => {
  test("summarizes actions for one or many items", () => {
    expect(describeAction("issues", { type: "status", value: "closed" }, [7])).toBe("Closed #7");
    expect(describeAction("pulls", { type: "status", value: "open" }, [1, 2])).toBe(
      "Reopened 2 pull requests",
    );
    expect(describeAction("issues", { type: "label", value: "bug", add: false }, [1, 2, 3])).toBe(
      "Removed bug from 3 issues",
    );
    expect(describeAction("issues", { type: "assignee", value: "mira", add: true }, [1, 2])).toBe(
      "Assigned mira to 2 issues",
    );
    expect(describeFailure("pulls", [3, 4], 2)).toBe("Couldn't update 2 pull requests");
    expect(describeFailure("issues", [3], 4)).toBe("Couldn't update 1 of 4 issues");
    expect(describeFailure("issues", [3], 1)).toBe("Couldn't update #3");
  });
});
