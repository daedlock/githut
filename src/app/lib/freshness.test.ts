import { expect, test } from "bun:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { queryClientForTab, refreshWorkspaceQueries } from "@/app/lib/freshness";
import { clearRateLimit, recordRateLimit } from "@/app/stores/rateLimit";
import { createWorkspace, focusedTab, islands, runCommand } from "@/app/workspace/model";

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
