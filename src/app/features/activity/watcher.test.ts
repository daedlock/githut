import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { onlineManager } from "@tanstack/react-query";
import { NOTIFICATIONS_KEY, useNotificationState } from "@/app/features/notifications/service";
import { queryClient } from "@/app/lib/query";
import { useAuthStore } from "@/app/stores/auth";
import { clearRateLimit, useRateLimitStore } from "@/app/stores/rateLimit";
import { useWorkspaceView } from "@/app/stores/workspaceView";
import { createWorkspace, focusedTab, islands, runCommand } from "@/app/workspace/model";
import { useWorkspaceStore } from "@/app/workspace/store";
import { useTabActivityStore } from "./store";
import { pageIsUnread, refreshBackgroundTabs } from "./watcher";

afterEach(() => {
  mock.restore();
  queryClient.clear();
  useAuthStore.getState().clear();
  clearRateLimit();
  onlineManager.setOnline(true);
  useWorkspaceView.setState({ narrow: false });
  useNotificationState.setState({ unread: {}, busy: [] });
  useTabActivityStore.setState({ account: null, statuses: {}, seen: {} });
});

function response(
  variables: Record<string, unknown>,
  activityAt: number,
  ci = "FAILURE",
  account = "account-1",
) {
  const data: Record<string, unknown> = { viewer: { id: account } };
  for (let index = 0; `number${index}` in variables; index++)
    data[`page${index}`] = {
      item: {
        title: `Pull ${variables[`number${index}`]}`,
        state: "OPEN",
        isDraft: false,
        updatedAt: new Date(activityAt).toISOString(),
        timelineItems: { updatedAt: new Date(activityAt).toISOString() },
        statusCheckRollup: { state: ci },
      },
    };
  return new Response(JSON.stringify({ data }), {
    headers: { "content-type": "application/json" },
  });
}

test("background status batches deduplicate aliases, exclude visible duplicates, obey cadence/backoff, and never freshen detail data", async () => {
  useAuthStore.getState().setToken("watcher-batches");
  const now = Date.now();
  const workspace = createWorkspace([
    "/",
    ...Array.from({ length: 12 }, (_, index) => `/demo/project/pull/${index + 1}`),
    "/demo/project/pr/1/files",
    "/demo/project/review/1",
  ]);
  useWorkspaceStore.setState({ workspace });
  const detailKey = ["pulls", "detail", "demo", "project", 1];
  queryClient.setQueryData(
    detailKey,
    { title: "Detailed title", body: "Preserve me" },
    { updatedAt: now - 100_000 },
  );
  const requests: Array<Record<string, unknown>> = [];
  spyOn(globalThis, "fetch").mockImplementation((async (
    _input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const { variables } = JSON.parse(String(init?.body));
    requests.push(variables);
    return response(variables, now - 2000);
  }) as typeof fetch);
  await Promise.all([refreshBackgroundTabs(now), refreshBackgroundTabs(now)]);
  expect(requests).toHaveLength(2);
  expect(
    requests.map(
      (variables) => Object.keys(variables).filter((key) => key.startsWith("number")).length,
    ),
  ).toEqual([10, 2]);
  expect(useTabActivityStore.getState().statuses["/demo/project/pull/1"]?.ci).toBe("failed");
  expect(queryClient.getQueryState(detailKey)?.dataUpdatedAt).toBe(now - 100_000);
  expect(queryClient.getQueryData<{ title: string; body: string }>(detailKey)).toEqual({
    title: "Detailed title",
    body: "Preserve me",
  });
  await refreshBackgroundTabs(now + 59_000);
  expect(requests).toHaveLength(2);
  useRateLimitStore.setState({
    buckets: { graphql: { slowUntil: now + 1_000_000, pausedUntil: 0 } },
  });
  await refreshBackgroundTabs(now + 61_000);
  expect(requests).toHaveLength(2);
  const viewed = runCommand(workspace, {
    type: "selectTab",
    tabId:
      workspace.layout.kind === "island" ? workspace.layout.tabs[1]!.id : focusedTab(workspace).id,
  });
  useWorkspaceStore.setState({ workspace: viewed });
  await refreshBackgroundTabs(now + 241_000);
  expect(requests).toHaveLength(4);
  expect(
    requests.slice(2).flatMap((variables) =>
      Object.entries(variables)
        .filter(([key]) => key.startsWith("number"))
        .map(([, number]) => number),
    ),
  ).not.toContain(1);
});

test("local activity survives session refresh, acknowledges a real view, and never leaks across accounts", async () => {
  const now = Date.now();
  const key = "/demo/project/pull/1";
  let activity = now - 10_000;
  let account = "account-1";
  useAuthStore.getState().setToken("local-activity");
  const workspace = createWorkspace(["/", key]);
  useWorkspaceStore.setState({ workspace });
  spyOn(globalThis, "fetch").mockImplementation((async (_input: unknown, init?: RequestInit) =>
    response(
      JSON.parse(String(init?.body)).variables,
      activity,
      "PENDING",
      account,
    )) as typeof fetch);
  await refreshBackgroundTabs(now);
  expect(pageIsUnread(key)).toBe(false);
  activity = now + 30_000;
  await refreshBackgroundTabs(now + 61_000);
  expect(pageIsUnread("/demo/project/pr/1/files")).toBe(true);
  // Reauthentication with the same viewer preserves the acknowledgement history.
  useAuthStore.getState().setToken("local-activity-refreshed");
  await refreshBackgroundTabs(now + 62_000);
  expect(pageIsUnread(key)).toBe(true);
  const tabId = workspace.layout.kind === "island" ? workspace.layout.tabs[1]!.id : "";
  useWorkspaceStore.setState({ workspace: runCommand(workspace, { type: "selectTab", tabId }) });
  await refreshBackgroundTabs(now + 63_000);
  expect(pageIsUnread(key)).toBe(false);
  expect(useTabActivityStore.getState().seen["account-1"]?.[key]).toBe(now + 63_000);
  useWorkspaceStore.setState({ workspace });
  activity = now + 70_000;
  await refreshBackgroundTabs(now + 123_000);
  expect(pageIsUnread(key)).toBe(true);
  account = "account-2";
  useAuthStore.getState().setToken("other-account");
  await refreshBackgroundTabs(now + 124_000);
  expect(pageIsUnread(key)).toBe(false);
  expect(useTabActivityStore.getState().seen["account-1"]?.[key]).toBe(now + 63_000);
});

test("notification read and device-only unread take precedence; Done does not resurrect fallback activity", async () => {
  const now = Date.now(),
    key = "/demo/project/pull/1";
  useAuthStore.getState().setToken("notification-source");
  useWorkspaceStore.setState({ workspace: createWorkspace(["/", key]) });
  let activity = now - 1000;
  spyOn(globalThis, "fetch").mockImplementation((async (_input: unknown, init?: RequestInit) =>
    response(JSON.parse(String(init?.body)).variables, activity)) as typeof fetch);
  await refreshBackgroundTabs(now);
  activity = now + 10_000;
  await refreshBackgroundTabs(now + 61_000);
  expect(pageIsUnread(key)).toBe(true);
  const notification = {
    id: "thread-1",
    unread: false,
    subject: { type: "PullRequest", url: "https://api.github.com/repos/demo/project/pulls/1" },
  };
  queryClient.setQueryData(NOTIFICATIONS_KEY, { items: [notification] });
  expect(pageIsUnread(key)).toBe(false);
  useNotificationState.setState({ unread: { "thread-1": true } });
  await refreshBackgroundTabs(now + 62_000);
  expect(pageIsUnread(key)).toBe(true);
  queryClient.setQueryData(NOTIFICATIONS_KEY, { items: [] });
  await refreshBackgroundTabs(now + 63_000);
  expect(pageIsUnread(key)).toBe(false);
  // A failed optimistic Done restores the notification as the source of truth.
  queryClient.setQueryData(NOTIFICATIONS_KEY, { items: [notification] });
  expect(pageIsUnread(key)).toBe(true);
});

test("a view before account identification is retained and slow responses cannot undo a later visit", async () => {
  const now = Date.now(),
    key = "/demo/project/pull/1";
  const workspace = createWorkspace([key, "/"]);
  useAuthStore.getState().setToken("inflight-view");
  useTabActivityStore.setState({ seen: { "account-1": { [key]: now - 100_000 } } });
  useWorkspaceStore.setState({ workspace });
  onlineManager.setOnline(false);
  await refreshBackgroundTabs(now);
  onlineManager.setOnline(true);
  let finish!: () => void;
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  let started = false;
  spyOn(globalThis, "fetch").mockImplementation((async (_input: unknown, init?: RequestInit) => {
    started = true;
    await gate;
    return response(JSON.parse(String(init?.body)).variables, now - 500);
  }) as typeof fetch);
  const home = workspace.layout.kind === "island" ? workspace.layout.tabs[1]!.id : "";
  useWorkspaceStore.setState({
    workspace: runCommand(workspace, { type: "selectTab", tabId: home }),
  });
  const pending = refreshBackgroundTabs(now + 1000);
  while (!started) await new Promise((resolve) => setTimeout(resolve, 0));
  finish();
  await pending;
  expect(pageIsUnread(key)).toBe(false);
  expect(useTabActivityStore.getState().seen["account-1"]?.[key]).toBe(now);
  let finishSecond!: () => void;
  const secondGate = new Promise<void>((resolve) => {
    finishSecond = resolve;
  });
  spyOn(globalThis, "fetch").mockImplementation((async (_input: unknown, init?: RequestInit) => {
    await secondGate;
    return response(JSON.parse(String(init?.body)).variables, now + 70_000);
  }) as typeof fetch);
  const second = refreshBackgroundTabs(now + 62_000);
  useWorkspaceStore.setState({ workspace });
  const view = refreshBackgroundTabs(now + 64_000);
  finishSecond();
  await Promise.all([second, view]);
  expect(pageIsUnread(key)).toBe(false);
});

test("offline/expired gates and account changes stop queued batches and discard old responses", async () => {
  const now = Date.now();
  useAuthStore.getState().setToken("queued-old-account");
  useWorkspaceStore.setState({
    workspace: createWorkspace([
      "/",
      ...Array.from({ length: 12 }, (_, index) => `/demo/project/pull/${index + 1}`),
    ]),
  });
  let finish!: () => void;
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  let calls = 0;
  spyOn(globalThis, "fetch").mockImplementation((async (_input: unknown, init?: RequestInit) => {
    calls++;
    await gate;
    return response(JSON.parse(String(init?.body)).variables, now);
  }) as typeof fetch);
  onlineManager.setOnline(false);
  await refreshBackgroundTabs(now);
  expect(calls).toBe(0);
  onlineManager.setOnline(true);
  useAuthStore.setState({ expired: true });
  await refreshBackgroundTabs(now);
  expect(calls).toBe(0);
  useAuthStore.setState({ expired: false });
  const pending = refreshBackgroundTabs(now);
  while (!calls) await new Promise((resolve) => setTimeout(resolve, 0));
  useAuthStore.getState().setToken("queued-new-account");
  finish();
  await pending;
  expect(calls).toBe(1);
  expect(useTabActivityStore.getState().statuses).toEqual({});
});

test("a visible duplicate uses existing detail activity without another status poll, and an unfocused island cannot acknowledge it", async () => {
  const now = Date.now(),
    key = "/demo/project/pull/1";
  useAuthStore.getState().setToken("visible-duplicate");
  const initial = createWorkspace(["/", key, "/demo/project/pr/1/files"]);
  useWorkspaceStore.setState({ workspace: initial });
  let calls = 0;
  spyOn(globalThis, "fetch").mockImplementation((async (_input: unknown, init?: RequestInit) => {
    calls++;
    return response(JSON.parse(String(init?.body)).variables, now - 1000);
  }) as typeof fetch);
  await refreshBackgroundTabs(now);
  const tabs = islands(initial.layout)[0]!.tabs;
  const split = runCommand(initial, {
    type: "dock",
    source: { type: "tab", tabId: tabs[2]!.id },
    target: { type: "workspace-edge", side: "right" },
  });
  useWorkspaceStore.setState({ workspace: split });
  await refreshBackgroundTabs(now + 1000);
  useWorkspaceStore.setState({
    workspace: runCommand(split, { type: "selectTab", tabId: tabs[0]!.id }),
  });
  queryClient.setQueryData(["pulls", "detail", "demo", "project", 1], {
    title: "Pull 1",
    updated_at: new Date(now + 30_000).toISOString(),
  });
  await refreshBackgroundTabs(now + 61_000);
  expect(calls).toBe(1);
  expect(pageIsUnread(key)).toBe(true);
  useWorkspaceStore.setState({ workspace: split });
  await refreshBackgroundTabs(now + 62_000);
  expect(pageIsUnread(key)).toBe(false);
});

test("Done during the first slow metadata request survives delayed account identification", async () => {
  const now = Date.now(),
    key = "/demo/project/pull/1";
  useAuthStore.getState().setToken("done-before-account");
  useTabActivityStore.setState({ seen: { "account-1": { [key]: now - 100_000 } } });
  useWorkspaceStore.setState({ workspace: createWorkspace(["/", key]) });
  queryClient.setQueryData(NOTIFICATIONS_KEY, {
    items: [
      {
        id: "thread",
        unread: true,
        subject: { type: "PullRequest", url: "https://api.github.com/repos/demo/project/pulls/1" },
      },
    ],
  });
  let finish!: () => void;
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  spyOn(globalThis, "fetch").mockImplementation((async (_input: unknown, init?: RequestInit) => {
    await gate;
    return response(JSON.parse(String(init?.body)).variables, now - 1000);
  }) as typeof fetch);
  const pending = refreshBackgroundTabs(now);
  queryClient.setQueryData(NOTIFICATIONS_KEY, { items: [] });
  const done = refreshBackgroundTabs(now + 1000);
  finish();
  await Promise.all([pending, done]);
  expect(pageIsUnread(key)).toBe(false);
});

test("visible pages identify the viewer once so later cached activity can mark a background duplicate unread", async () => {
  const now = Date.now(),
    key = "/demo/project/pull/1";
  useAuthStore.getState().setToken("visible-first");
  const initial = createWorkspace([key, "/demo/project/pr/1/files", "/"]);
  const tabs = islands(initial.layout)[0]!.tabs;
  const split = runCommand(initial, {
    type: "dock",
    source: { type: "tab", tabId: tabs[1]!.id },
    target: { type: "workspace-edge", side: "right" },
  });
  useWorkspaceStore.setState({ workspace: split });
  const requests: Array<{ query: string; variables: Record<string, unknown> }> = [];
  spyOn(globalThis, "fetch").mockImplementation((async (_input: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    requests.push(body);
    return response(body.variables, now - 1000);
  }) as typeof fetch);
  await refreshBackgroundTabs(now);
  expect(requests).toHaveLength(1);
  expect(requests[0]?.variables).toEqual({});
  expect(requests[0]?.query).not.toContain("repository");
  useWorkspaceStore.setState({
    workspace: runCommand(split, { type: "selectTab", tabId: tabs[2]!.id }),
  });
  queryClient.setQueryData(["pulls", "detail", "demo", "project", 1], {
    updated_at: new Date(now + 30_000).toISOString(),
  });
  await refreshBackgroundTabs(now + 61_000);
  expect(requests).toHaveLength(1);
  expect(pageIsUnread(key)).toBe(true);
});
