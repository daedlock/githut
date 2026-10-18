import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { clearETagCache } from "@/app/lib/github/client";
import { useAuthStore } from "@/app/stores/auth";
import { fetchActionSignal, fetchTabStatuses } from "./api";
import { activityPage, useIssueActivityFilters } from "./pages";
import { publishStatuses, useTabActivityStore } from "./store";

afterEach(() => {
  mock.restore();
  useAuthStore.getState().clear();
  clearETagCache();
  useIssueActivityFilters.setState({ tabs: {} });
  useTabActivityStore.setState({ account: null, statuses: {}, seen: {} });
});
test("one mixed GraphQL batch uses creation times, exact local issue filters and a branch head", async () => {
  useAuthStore.getState().setToken("mixed-signals");
  useIssueActivityFilters.setState({
    tabs: {
      issues: {
        state: "open",
        text: "author-match",
        filters: [
          { fieldId: "label", op: "is", value: "bug" },
          { fieldId: "assignee", op: "is_not", value: "bot" },
        ],
      },
    },
  });
  const pages = [
    activityPage("/o/r/pulls?label=bug")!,
    activityPage("/o/r/issues", "issues")!,
    activityPage("/o/r/code?branch=topic")!,
  ];
  let calls = 0;
  spyOn(globalThis, "fetch").mockImplementation((async (_input, init) => {
    calls++;
    const { query, variables } = JSON.parse(String(init?.body));
    expect(variables.search0).toContain('label:"bug" sort:created-desc');
    expect(variables.search1).toContain("is:issue is:open");
    expect(variables.search1).toContain('label:"bug"');
    expect(variables.search1).toContain('-assignee:"bot"');
    expect(variables.ref2).toBe("topic^{commit}");
    expect(query).not.toContain("updatedAt");
    const issue = {
      createdAt: "2026-10-18T10:00:00Z",
      state: "OPEN",
      title: "Some issue",
      body: "",
      author: { login: "author-match" },
      labels: { nodes: [{ name: "bug" }] },
      assignees: { nodes: [] },
    };
    return Response.json({
      data: {
        viewer: { id: "me" },
        page0: { nodes: [{ createdAt: "2026-10-18T09:00:00Z" }] },
        page1: {
          nodes: [
            issue,
            {
              ...issue,
              createdAt: "2026-10-18T11:00:00Z",
              author: { login: "unrelated" },
            },
          ],
        },
        page2: { item: { oid: "head-1", committedDate: "2026-10-17T00:00:00Z" } },
      },
    });
  }) as typeof fetch);
  const result = await fetchTabStatuses(pages);
  expect(calls).toBe(1);
  expect(result.failed).toEqual([]);
  expect(result.items.map((i) => i.activityAt)).toEqual(
    ["2026-10-18T09:00:00Z", "2026-10-18T10:00:00Z", "2026-10-17T00:00:00Z"].map(Date.parse),
  );
  expect(result.items[2]?.fingerprint).toBe("head-1");
});
test("Actions retains exact workflow filters and uses ETag conditional reads", async () => {
  useAuthStore.getState().setToken("actions-signals");
  const page = activityPage(
    "/o/r/actions?workflow=42&status=failure&branch=topic&event=push&actor=alice",
  )!;
  if (page.kind !== "actions") throw Error("wrong scope");
  let calls = 0;
  spyOn(globalThis, "fetch").mockImplementation((async (input, init) => {
    const url = new URL(String(input));
    expect(url.pathname).toBe("/repos/o/r/actions/workflows/42/runs");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      status: "failure",
      branch: "topic",
      event: "push",
      actor: "alice",
      per_page: "1",
    });
    if (calls++) {
      expect(new Headers(init?.headers).get("if-none-match")).toBe('"run-list"');
      return new Response(null, { status: 304 });
    }
    return Response.json(
      {
        workflow_runs: [
          {
            id: 5,
            created_at: "2026-10-18T09:00:00Z",
            updated_at: "2026-10-18T10:00:00Z",
            status: "completed",
            conclusion: "failure",
          },
        ],
      },
      { headers: { etag: '"run-list"' } },
    );
  }) as typeof fetch);
  const first = await fetchActionSignal(page);
  expect((await fetchActionSignal(page)).activityAt).toBe(first.activityAt);
  expect(first.activityAt).toBe(Date.parse("2026-10-18T09:00:00Z"));
  expect(calls).toBe(2);
});
test("head changes with older dates still mark activity; unchanged heads never manufacture activity", () => {
  const item = {
    key: "/o/r/code",
    title: "",
    state: "open" as const,
    ci: null,
    activityAt: 100,
    fingerprint: "one",
  };
  publishStatuses("me", [item], 1000, new Map());
  publishStatuses("me", [item], 2000, new Map());
  expect(useTabActivityStore.getState().statuses[item.key]?.activityAt).toBe(100);
  publishStatuses("me", [{ ...item, activityAt: 50, fingerprint: "two" }], 3000, new Map());
  expect(useTabActivityStore.getState().statuses[item.key]?.activityAt).toBe(3000);
  expect(useTabActivityStore.getState().seen.me?.[item.key]).toBe(1000);
  publishStatuses("me", [{ ...item, fingerprint: "two" }], 4000, new Map([[item.key, 4000]]));
  expect(useTabActivityStore.getState().seen.me?.[item.key]).toBe(4000);
});

import { observeVisibleSignal } from "./visibleSignal";

test("shown heads replace background fingerprints and seed older-dated first changes", () => {
  const now = Date.now();
  const item = {
    key: "/o/r/code",
    title: "",
    state: "open" as const,
    ci: null,
    activityAt: 100,
    fingerprint: "A",
  };
  publishStatuses("me", [item], now - 3000, new Map());
  observeVisibleSignal(item.key, "B", 200, now - 2000);
  publishStatuses("me", [{ ...item, fingerprint: "B", activityAt: 200 }], now + 1000, new Map());
  expect(useTabActivityStore.getState().statuses[item.key]!.activityAt).toBeLessThanOrEqual(
    useTabActivityStore.getState().seen.me![item.key]!,
  );
  observeVisibleSignal("/first", "A", 100, now);
  publishStatuses(
    "me",
    [{ ...item, key: "/first", fingerprint: "B", activityAt: 50 }],
    now + 2000,
    new Map(),
  );
  expect(useTabActivityStore.getState().statuses["/first"]!.activityAt).toBeGreaterThan(
    useTabActivityStore.getState().seen.me!["/first"]!,
  );
});
