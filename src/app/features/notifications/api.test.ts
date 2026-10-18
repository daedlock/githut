import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { clearETagCache, getGitHubClient } from "@/app/lib/github/client";
import { useAuthStore } from "@/app/stores/auth";
import { appendPage, fetchNotificationPage, isParticipating, mergeFirstPage } from "./api";

export const notification = (id: string, unread = true) => ({
  id,
  unread,
  reason: "mention",
  updated_at: "2026-10-17T10:00:00Z",
  last_read_at: null,
  subject: {
    title: `Notification ${id}`,
    type: "Issue",
    url: `https://api.github.com/repos/demo/project/issues/${id}`,
    latest_comment_url: null,
  },
  repository: { full_name: "demo/project", html_url: "https://github.com/demo/project" },
});
afterEach(() => {
  mock.restore();
  clearETagCache();
  useAuthStore.getState().clear();
});

test("a poll is one request for the first page; older pages load on request and merge without duplicates", async () => {
  useAuthStore.getState().setToken("notification-pagination");
  const requests: URL[] = [];
  spyOn(globalThis, "fetch").mockImplementation((async (input: string | URL | Request) => {
    const url = new URL(String(input));
    requests.push(url);
    const second = url.searchParams.get("page") === "2";
    const data = second
      ? [notification("2", false), { ...notification("3"), reason: "subscribed" }]
      : [notification("1"), notification("2", false)];
    return new Response(JSON.stringify(data), {
      headers: {
        "content-type": "application/json",
        "x-poll-interval": "120",
        ...(!second ? { link: '<https://api.github.com/notifications?page=2>; rel="next"' } : {}),
      },
    });
  }) as typeof fetch);
  const first = mergeFirstPage(await fetchNotificationPage(1));
  expect(first.items.map((item) => item.id)).toEqual(["1", "2"]);
  expect(first.hasMore).toBe(true);
  expect(first.pollInterval).toBe(120_000);
  expect(requests).toHaveLength(1);
  const feed = appendPage(first, await fetchNotificationPage(2));
  expect(feed.items.map((item) => item.id)).toEqual(["1", "2", "3"]);
  expect(feed.pages).toBe(2);
  expect(feed.hasMore).toBe(false);
  expect(feed.items.filter(isParticipating).map((item) => item.id)).toEqual(["1", "2"]);
  expect(
    requests.every(
      (url) =>
        url.searchParams.get("all") === "true" &&
        url.searchParams.get("per_page") === "50" &&
        !url.searchParams.has("participating"),
    ),
  ).toBe(true);
});

test("notification polling reuses Last-Modified bodies and thread writes patch those snapshots instead of dropping them", async () => {
  useAuthStore.getState().setToken("notification-conditional");
  const date = "Sat, 17 Oct 2026 10:00:00 GMT";
  const sent: Array<{ method: string; since: string | null }> = [];
  let reads = 0;
  spyOn(globalThis, "fetch").mockImplementation((async (
    _input: string | URL | Request,
    init?: RequestInit,
  ) => {
    sent.push({
      method: init?.method ?? "GET",
      since: new Headers(init?.headers).get("if-modified-since"),
    });
    if (init?.method === "PATCH") return new Response(null, { status: 205 });
    reads++;
    return reads >= 2
      ? new Response(null, { status: 304, headers: { "x-poll-interval": "120" } })
      : new Response(JSON.stringify([notification("1", reads === 1)]), {
          headers: {
            "content-type": "application/json",
            "last-modified": date,
            "x-poll-interval": "60",
          },
        });
  }) as typeof fetch);
  const client = getGitHubClient();
  await client.request("GET /notifications", { all: true });
  const unchanged = await client.request("GET /notifications", { all: true });
  expect(unchanged.data[0]?.id).toBe("1");
  expect(unchanged.data[0]?.unread).toBe(true);
  expect(unchanged.headers["x-poll-interval"]).toBe("120");
  await client.request("PATCH /notifications/threads/{thread_id}", { thread_id: 1 });
  const afterRead = await client.request("GET /notifications", { all: true });
  expect(afterRead.data[0]?.unread).toBe(false);
  expect(sent.map((request) => request.since)).toEqual([null, date, null, date]);
});
