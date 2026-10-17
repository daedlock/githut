import { expect, spyOn, test } from "bun:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { jobLogsQueryOptions } from "@/app/features/actions/hooks";
import { queryClientForTab, refreshWorkspaceQueries } from "@/app/lib/freshness";
import { useAuthStore } from "@/app/stores/auth";
import { clearRateLimit, recordRateLimit } from "@/app/stores/rateLimit";
import { useWorkspaceView } from "@/app/stores/workspaceView";
import { createWorkspace, focusedTab, islands, runCommand } from "@/app/workspace/model";

test("narrow mode pauses hidden island queries and refetches stale data when that island is shown", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let workspace = runCommand(createWorkspace(["/one"]), { type: "splitIsland", side: "right" });
  const hidden = islands(workspace.layout)[0]!;
  const key = ["narrow-comments", hidden.id];
  client.setQueryData(key, "cached", { updatedAt: 1000 });
  useWorkspaceView.getState().setNarrow(true);
  const observer = new QueryObserver(
    queryClientForTab(client, hidden.selectedTabId, () => workspace),
    {
      queryKey: key,
      queryFn: async () => "updated",
      staleTime: 30_000,
    },
  );
  const stop = observer.subscribe(() => {});
  try {
    await refreshWorkspaceQueries(client, workspace, { now: 61_000 });
    await client.invalidateQueries({ queryKey: key });
    expect(client.getQueryData<string>(key)).toBe("cached");
    workspace = runCommand(workspace, { type: "focusIsland", islandId: hidden.id });
    await refreshWorkspaceQueries(client, workspace, { now: 61_000 });
    expect(client.getQueryData<string>(key)).toBe("updated");
  } finally {
    stop();
    client.clear();
    useWorkspaceView.getState().setNarrow(false);
  }
});

test("focused changing data refreshes at 15 seconds through its existing cached query", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const workspace = createWorkspace(["/demo/repo/pull/1"]);
  const key = ["pulls", "comments", "demo", "repo", 1];
  client.setQueryData(key, ["original comment"], { updatedAt: 1000 });
  const observer = new QueryObserver(
    queryClientForTab(client, focusedTab(workspace).id, () => workspace),
    {
      queryKey: key,
      queryFn: async () => ["original comment", "new comment"],
      staleTime: 30_000,
    },
  );
  const unsubscribe = observer.subscribe(() => {});
  try {
    await refreshWorkspaceQueries(client, workspace, { now: 15_999, visible: true });
    expect(client.getQueryData<string[]>(key)).toEqual(["original comment"]);
    await refreshWorkspaceQueries(client, workspace, { now: 16_000, visible: true });
    expect(client.getQueryData<string[]>(key)).toEqual(["original comment", "new comment"]);
  } finally {
    unsubscribe();
    client.clear();
  }
});

test("a visible island refreshes running CI at 3 seconds and ordinary data at 60 seconds", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const workspace = runCommand(createWorkspace(["/ci"]), { type: "splitIsland", side: "right" });
  const visibleTab = islands(workspace.layout)[0]!.selectedTabId;
  const scoped = queryClientForTab(client, visibleTab, () => workspace);
  const ci = ["actions-run", "demo", "repo", 1];
  const comments = ["pulls", "comments", "demo", "repo", 1];
  client.setQueryData(ci, { status: "in_progress" }, { updatedAt: 1000 });
  client.setQueryData(comments, ["old"], { updatedAt: 1000 });
  const run = new QueryObserver(scoped, {
    queryKey: ci,
    queryFn: async () => ({ status: "completed" }),
    staleTime: 5_000,
    refetchInterval: (query) => (query.state.data?.status === "in_progress" ? 3000 : false),
  });
  const discussion = new QueryObserver(scoped, {
    queryKey: comments,
    queryFn: async () => ["old", "new"],
    staleTime: 30_000,
  });
  const cleanup = [run.subscribe(() => {}), discussion.subscribe(() => {})];
  try {
    await refreshWorkspaceQueries(client, workspace, { now: 3999, visible: true });
    expect(client.getQueryData<{ status: string }>(ci)).toEqual({ status: "in_progress" });
    await refreshWorkspaceQueries(client, workspace, { now: 4000, visible: true });
    expect(client.getQueryData<{ status: string }>(ci)).toEqual({ status: "completed" });
    expect(client.getQueryData<string[]>(comments)).toEqual(["old"]);
    await refreshWorkspaceQueries(client, workspace, { now: 61_000, visible: true });
    expect(client.getQueryData<string[]>(comments)).toEqual(["old", "new"]);
  } finally {
    cleanup.forEach((stop) => {
      stop();
    });
    client.clear();
  }
});

test("background tabs freeze and focusing a stale tab refreshes it, while hidden windows stay paused", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let workspace = createWorkspace(["/one", "/two"]);
  const tab = islands(workspace.layout)[0]!.tabs[1]!;
  const key = ["comments", tab.id];
  client.setQueryData(key, ["cached"], { updatedAt: 1000 });
  const observer = new QueryObserver(
    queryClientForTab(client, tab.id, () => workspace),
    {
      queryKey: key,
      queryFn: async () => ["updated"],
      staleTime: 30_000,
    },
  );
  const unsubscribe = observer.subscribe(() => {});
  try {
    await refreshWorkspaceQueries(client, workspace, { now: 61_000, visible: true });
    expect(client.getQueryData<string[]>(key)).toEqual(["cached"]);
    await client.invalidateQueries({ queryKey: key });
    expect(client.getQueryData<string[]>(key)).toEqual(["cached"]);
    workspace = runCommand(workspace, { type: "selectTab", tabId: tab.id });
    await refreshWorkspaceQueries(client, workspace, { now: 61_000, visible: false });
    expect(client.getQueryData<string[]>(key)).toEqual(["cached"]);
    await refreshWorkspaceQueries(client, workspace, { now: 61_000, visible: true });
    expect(client.getQueryData<string[]>(key)).toEqual(["updated"]);
  } finally {
    unsubscribe();
    client.clear();
  }
});

test("low rate headroom slows each shared query once, including a duplicate visible page", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const workspace = runCommand(createWorkspace(["/one"]), { type: "splitIsland", side: "right" });
  const key = ["comments", 1];
  const time = Date.now();
  let requests = 0;
  client.setQueryData(key, ["cached"], { updatedAt: time });
  recordRateLimit(
    new Headers({
      "x-ratelimit-limit": "5000",
      "x-ratelimit-remaining": "499",
      "x-ratelimit-reset": String(Math.floor(time / 1000) + 300),
    }),
  );
  const cleanup = islands(workspace.layout).map((island) =>
    new QueryObserver(
      queryClientForTab(client, island.selectedTabId, () => workspace),
      {
        queryKey: key,
        queryFn: async () => {
          requests++;
          return ["updated"];
        },
        staleTime: 30_000,
      },
    ).subscribe(() => {}),
  );
  try {
    await refreshWorkspaceQueries(client, workspace, { now: time + 59_999, visible: true });
    expect(requests).toBe(0);
    await refreshWorkspaceQueries(client, workspace, { now: time + 60_000, visible: true });
    expect(requests).toBe(1);
  } finally {
    cleanup.forEach((stop) => {
      stop();
    });
    client.clear();
    clearRateLimit();
  }
});

test("a focused island refreshes stale repo metadata without polling immutable files", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const workspace = createWorkspace(["/repo"]);
  const scoped = queryClientForTab(client, focusedTab(workspace).id, () => workspace);
  const metadata = ["repo", "demo", "repo"];
  const immutable = ["repo-file", "demo", "repo", "commit-sha", "file"];
  client.setQueryData(metadata, "old branch", { updatedAt: 1000 });
  client.setQueryData(immutable, "unchanged", { updatedAt: 1000 });
  const cleanup = [
    new QueryObserver(scoped, {
      queryKey: metadata,
      queryFn: async () => "new branch",
      staleTime: 300_000,
    }).subscribe(() => {}),
    new QueryObserver(scoped, {
      queryKey: immutable,
      queryFn: async () => "should not fetch",
      staleTime: Infinity,
    }).subscribe(() => {}),
  ];
  try {
    await refreshWorkspaceQueries(client, workspace, { now: 301_000 });
    expect(client.getQueryData<string>(metadata)).toBe("new branch");
    expect(client.getQueryData<string>(immutable)).toBe("unchanged");
  } finally {
    cleanup.forEach((stop) => {
      stop();
    });
    client.clear();
  }
});

test("an immutable query first mounted in a background tab loads when that tab becomes visible", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let workspace = createWorkspace(["/one", "/file"]);
  const tab = islands(workspace.layout)[0]!.tabs[1]!;
  const key = ["repo-file", "demo", "repo", "commit-sha", "file"];
  const observer = new QueryObserver(
    queryClientForTab(client, tab.id, () => workspace),
    {
      queryKey: key,
      queryFn: async () => "file contents",
      staleTime: Infinity,
    },
  );
  const unsubscribe = observer.subscribe(() => {});
  try {
    await refreshWorkspaceQueries(client, workspace);
    expect(client.getQueryData<string>(key)).toBeUndefined();
    workspace = runCommand(workspace, { type: "selectTab", tabId: tab.id });
    await refreshWorkspaceQueries(client, workspace);
    expect(client.getQueryData<string>(key)).toBe("file contents");
  } finally {
    unsubscribe();
    client.clear();
  }
});

test.each([
  403, 410, 429,
])("terminal %i Actions log failures stop requesting logs while the job stays visible", async (status) => {
  useAuthStore.getState().setToken("log-test");
  const send = spyOn(globalThis, "fetch").mockResolvedValue(
    new Response("unavailable", { status }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const workspace = createWorkspace(["/demo/project/actions/runs/1"]);
  const observer = new QueryObserver(
    queryClientForTab(client, focusedTab(workspace).id, () => workspace),
    {
      ...jobLogsQueryOptions("demo", "project", 1),
    },
  );
  const unsubscribe = observer.subscribe(() => {});
  try {
    await observer.refetch();
    await refreshWorkspaceQueries(client, workspace, { now: Date.now() + 16_000 });
    await refreshWorkspaceQueries(client, workspace, { now: Date.now() + 32_000 });
    expect(observer.getCurrentResult().error).toMatchObject({ status });
    expect(send).toHaveBeenCalledTimes(1);
  } finally {
    unsubscribe();
    client.clear();
    send.mockRestore();
    useAuthStore.getState().clear();
  }
});

test("completed logs first load on reveal, retry during materialization and stop at the grace deadline", async () => {
  let now = 50_000;
  const clock = spyOn(Date, "now").mockImplementation(() => now);
  useAuthStore.getState().setToken("materializing-log-test");
  const send = spyOn(globalThis, "fetch").mockResolvedValue(
    new Response("not yet", { status: 404 }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let workspace = createWorkspace(["/one", "/demo/project/actions/runs/1"]);
  const tab = islands(workspace.layout)[0]!.tabs[1]!;
  const observer = new QueryObserver(
    queryClientForTab(client, tab.id, () => workspace),
    jobLogsQueryOptions("demo", "project", 1, { pollUntil: 55_000 }),
  );
  const stop = observer.subscribe(() => {});
  try {
    await refreshWorkspaceQueries(client, workspace);
    expect(send).not.toHaveBeenCalled();
    workspace = runCommand(workspace, { type: "selectTab", tabId: tab.id });
    await refreshWorkspaceQueries(client, workspace);
    expect(send).toHaveBeenCalledTimes(1);
    now = 53_000;
    await refreshWorkspaceQueries(client, workspace);
    expect(send).toHaveBeenCalledTimes(2);
    now = 56_000;
    await refreshWorkspaceQueries(client, workspace);
    now = 80_000;
    await refreshWorkspaceQueries(client, workspace);
    expect(send).toHaveBeenCalledTimes(2);
    expect(observer.getCurrentResult().error).toMatchObject({ status: 404 });
  } finally {
    stop();
    client.clear();
    send.mockRestore();
    clock.mockRestore();
    useAuthStore.getState().clear();
  }
});

test("live Actions logs honor terminal response stops without stopping completed CI metadata refreshes", async () => {
  useAuthStore.getState().setToken("live-log-test");
  const send = spyOn(globalThis, "fetch").mockResolvedValue(
    new Response("rate limited", { status: 429 }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const workspace = createWorkspace(["/demo/project/actions/runs/1"]);
  const scoped = queryClientForTab(client, focusedTab(workspace).id, () => workspace);
  const observer = new QueryObserver(
    scoped,
    jobLogsQueryOptions("demo", "project", 1, { isLive: true }),
  );
  const metadata = ["actions-run", "demo", "project", 1];
  client.setQueryData(metadata, "completed", { updatedAt: 1 });
  const run = new QueryObserver(scoped, {
    queryKey: metadata,
    queryFn: async () => "completed and refreshed",
    staleTime: 5000,
    refetchInterval: () => false,
  });
  const cleanup = [observer.subscribe(() => {}), run.subscribe(() => {})];
  try {
    await observer.refetch();
    await refreshWorkspaceQueries(client, workspace, { now: Date.now() + 16_000 });
    expect(client.getQueryData<string>(metadata)).toBe("completed and refreshed");
    expect(send).toHaveBeenCalledTimes(1);
  } finally {
    cleanup.forEach((stop) => {
      stop();
    });
    client.clear();
    send.mockRestore();
    useAuthStore.getState().clear();
  }
});
