import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { useAuthStore } from "@/app/stores/auth";
import { fetchTabStatuses, pageEntity } from "./api";

afterEach(() => {
  mock.restore();
  useAuthStore.getState().clear();
});

test("a lightweight batch uses variables, normalizes aliases, and retains good results when one resource fails", async () => {
  useAuthStore.getState().setToken("watcher-api");
  const requests: Array<{ query: string; variables: Record<string, unknown> }> = [];
  spyOn(globalThis, "fetch").mockImplementation((async (
    _input: string | URL | Request,
    init?: RequestInit,
  ) => {
    requests.push(JSON.parse(String(init?.body)));
    return new Response(
      JSON.stringify({
        data: {
          viewer: { id: "viewer-1" },
          page0: {
            item: {
              title: "Fix it",
              state: "OPEN",
              isDraft: false,
              updatedAt: "2026-10-17T10:00:00Z",
              timelineItems: { updatedAt: "2026-10-17T10:01:00Z" },
              statusCheckRollup: { state: "FAILURE" },
            },
          },
          page1: null,
        },
        errors: [{ path: ["page1"], message: "Not found" }],
      }),
      { headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch);
  const pr = pageEntity("/Owner/Project/pr/12/files?x=y")!;
  const issue = pageEntity("/owner/project/issues/9#comment")!;
  expect(pr.key).toBe("/owner/project/pull/12");
  expect(pageEntity("/owner/project/pulls")).toBeNull();
  const result = await fetchTabStatuses([pr, issue]);
  expect(requests).toHaveLength(1);
  expect(requests[0]?.variables).toEqual({
    owner0: "owner",
    repo0: "project",
    number0: 12,
    owner1: "owner",
    repo1: "project",
    number1: 9,
  });
  expect(requests[0]?.query).not.toContain("body");
  expect(result.account).toBe("viewer-1");
  expect(result.items[0]).toMatchObject({
    key: pr.key,
    title: "Fix it",
    state: "open",
    ci: "failed",
    activityAt: Date.parse("2026-10-17T10:01:00Z"),
  });
  expect(result.failed).toEqual([issue.key]);
});
