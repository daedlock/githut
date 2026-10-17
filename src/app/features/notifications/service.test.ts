import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { clearETagCache } from "@/app/lib/github/client";
import { queryClient } from "@/app/lib/query";
import { useAuthStore } from "@/app/stores/auth";
import { clearRateLimit, useRateLimitStore } from "@/app/stores/rateLimit";
import {
  NOTIFICATIONS_KEY,
  notificationIsUnread,
  refreshNotifications,
  runNotificationAction,
  useNotificationState,
} from "./service";

const item = (id: string, unread = true) => ({
  id,
  unread,
  reason: "mention",
  updated_at: "2026-10-17T10:00:00Z",
  last_read_at: null,
  subject: {
    title: `Thread ${id}`,
    type: "Issue",
    url: `https://api.github.com/repos/demo/project/issues/${id}`,
  },
  repository: { full_name: "demo/project", html_url: "https://github.com/demo/project" },
});
const feed = () => ({
  items: [item("1"), item("2", false)],
  participatingIds: ["1", "2"],
  pollInterval: 60_000,
});
afterEach(() => {
  mock.restore();
  queryClient.clear();
  clearETagCache();
  clearRateLimit();
  useAuthStore.getState().clear();
  useNotificationState.setState({ unread: {}, busy: [] });
});

test("device-only unread survives refresh and only explicit read clears it; GitHub writes use real thread endpoints", async () => {
  useAuthStore.getState().setToken("notification-actions");
  queryClient.setQueryData(NOTIFICATIONS_KEY, feed());
  const requests: Array<{ method: string; path: string; body: unknown }> = [];
  spyOn(globalThis, "fetch").mockImplementation((async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    requests.push({
      method: init?.method ?? "GET",
      path: new URL(String(input)).pathname,
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });
    return new Response(null, { status: init?.method === "PATCH" ? 205 : 204 });
  }) as typeof fetch);
  await runNotificationAction(["2"], "unread");
  expect(requests).toHaveLength(0);
  queryClient.setQueryData(NOTIFICATIONS_KEY, feed());
  expect(notificationIsUnread(item("2", false))).toBe(true);
  await runNotificationAction(["2"], "read");
  expect(notificationIsUnread(item("2", false))).toBe(false);
  await runNotificationAction(["1"], "unsubscribe");
  expect(
    queryClient.getQueryData<typeof feed extends () => infer T ? T : never>(NOTIFICATIONS_KEY)
      ?.items,
  ).toHaveLength(2);
  await runNotificationAction(["1"], "done");
  expect(
    queryClient
      .getQueryData<ReturnType<typeof feed>>(NOTIFICATIONS_KEY)
      ?.items.map((row) => row.id),
  ).toEqual(["2"]);
  expect(requests).toEqual([
    { method: "PATCH", path: "/notifications/threads/2", body: null },
    { method: "PUT", path: "/notifications/threads/1/subscription", body: { ignored: true } },
    { method: "DELETE", path: "/notifications/threads/1", body: null },
  ]);
});

test("bulk failures restore only failed threads and keep their local unread state", async () => {
  useAuthStore.getState().setToken("notification-partial");
  queryClient.setQueryData(NOTIFICATIONS_KEY, feed());
  await runNotificationAction(["2"], "unread");
  spyOn(globalThis, "fetch").mockImplementation(
    (async (input: string | URL | Request) =>
      new Response(
        String(input).endsWith("/2") ? JSON.stringify({ message: "Not allowed" }) : null,
        {
          status: String(input).endsWith("/2") ? 403 : 204,
          headers: { "content-type": "application/json" },
        },
      )) as typeof fetch,
  );
  const result = await runNotificationAction(["1", "2"], "done");
  expect(result.succeeded).toEqual(["1"]);
  expect(result.failed.map((failure) => failure.id)).toEqual(["2"]);
  expect(
    queryClient
      .getQueryData<ReturnType<typeof feed>>(NOTIFICATIONS_KEY)
      ?.items.map((row) => row.id),
  ).toEqual(["2"]);
  expect(notificationIsUnread(item("2", false))).toBe(true);
});

test("polling shares one request, obeys GitHub cadence and low-quota backoff, and pauses expired sessions", async () => {
  useAuthStore.getState().setToken("notification-poll");
  const requests: string[] = [];
  spyOn(globalThis, "fetch").mockImplementation((async (input: string | URL | Request) => {
    requests.push(String(input));
    return new Response(JSON.stringify([item("1")]), {
      headers: { "content-type": "application/json", "x-poll-interval": "120" },
    });
  }) as typeof fetch);
  const now = Date.now();
  await Promise.all([refreshNotifications(now), refreshNotifications(now)]);
  expect(requests).toHaveLength(2);
  await refreshNotifications(now + 119_000);
  expect(requests).toHaveLength(2);
  useRateLimitStore.setState({ slowUntil: now + 1_000_000 });
  await refreshNotifications(now + 121_000);
  expect(requests).toHaveLength(2);
  await refreshNotifications(now + 481_000);
  expect(requests).toHaveLength(4);
  useAuthStore.getState().markExpired();
  await refreshNotifications(now + 1_000_000);
  expect(requests).toHaveLength(4);
});
