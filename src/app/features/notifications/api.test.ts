import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { clearETagCache, getGitHubClient } from "@/app/lib/github/client";
import { useAuthStore } from "@/app/stores/auth";
import { fetchNotifications } from "./api";

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

test("the shared notification feed includes read threads, follows both server filters and pagination, and keeps the slowest poll interval", async () => {
  useAuthStore.getState().setToken("notification-pagination");
  const requests: URL[] = [];
  spyOn(globalThis, "fetch").mockImplementation((async (input: string | URL | Request) => {
    const url = new URL(String(input));
    requests.push(url);
    const participating = url.searchParams.get("participating") === "true";
    const second = url.searchParams.get("page") === "2";
    const data = participating
      ? [notification("2", false)]
      : second
        ? [notification("3")]
        : [notification("1"), notification("2", false)];
    return new Response(JSON.stringify(data), {
      headers: {
        "content-type": "application/json",
        "x-poll-interval": participating ? "120" : "60",
        ...(!participating && !second
          ? { link: '<https://api.github.com/notifications?page=2>; rel="next"' }
          : {}),
      },
    });
  }) as typeof fetch);
  const feed = await fetchNotifications();
  expect(feed.items.map((item) => item.id)).toEqual(["1", "2", "3"]);
  expect(feed.participatingIds).toEqual(["2"]);
  expect(feed.pollInterval).toBe(120_000);
  expect(requests).toHaveLength(3);
  expect(
    requests.every(
      (url) => url.searchParams.get("all") === "true" && url.searchParams.get("per_page") === "50",
    ),
  ).toBe(true);
});

test("notification polling reuses Last-Modified bodies and writes invalidate those conditional snapshots", async () => {
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
    return reads === 2
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
  await client.request("GET /notifications", { all: true });
  expect(sent.map((request) => request.since)).toEqual([null, date, null, null]);
});
