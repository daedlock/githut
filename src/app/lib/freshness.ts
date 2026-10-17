import { onlineManager, type QueryClient, type QueryObserverOptions } from "@tanstack/react-query";
import { expireRateLimit, getRateBackoff, useRateLimitStore } from "@/app/stores/rateLimit";
import { focusedTab, islands, type Workspace } from "@/app/workspace/model";
import { getWorkspace, useWorkspaceStore } from "@/app/workspace/store";

type FreshnessMeta = {
  tabId: string;
  interval: QueryObserverOptions["refetchInterval"];
};

/**
 * A view of the one shared client, with observer ownership added to its defaults.
 * All other operations, caches, subscriptions and mutations use the real client.
 */
export function queryClientForTab(
  client: QueryClient,
  tabId: string,
  workspace = getWorkspace,
): QueryClient {
  const defaults: QueryClient["defaultQueryOptions"] = (options) => {
    const result = client.defaultQueryOptions(options);
    const previous = result.meta?.workspaceFreshness as FreshnessMeta | undefined;
    if (previous?.tabId === tabId) return result;
    return {
      ...result,
      meta: {
        ...result.meta,
        workspaceFreshness: previous ?? { tabId, interval: result.refetchInterval },
      },
      refetchInterval: false,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      enabled: (query) =>
        windowVisible() &&
        onlineManager.isOnline() &&
        visibleTabs(workspace()).has(tabId) &&
        (typeof result.enabled === "function"
          ? result.enabled(query) !== false
          : result.enabled !== false),
    };
  };
  return new Proxy(client, {
    get(target, key) {
      if (key === "defaultQueryOptions") return defaults;
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

/** One pass over the shared cache: even duplicate pages fetch each query once. */
export async function refreshWorkspaceQueries(
  client: QueryClient,
  workspace: Workspace,
  { now = Date.now(), visible = true }: { now?: number; visible?: boolean } = {},
): Promise<void> {
  if (!visible || !onlineManager.isOnline()) return;
  const focused = focusedTab(workspace).id;
  const shown = visibleTabs(workspace);
  const requests: Promise<unknown>[] = [];
  for (const query of client.getQueryCache().getAll()) {
    if (query.state.fetchStatus !== "idle") continue;
    let observer = query.observers[0];
    let interval = Infinity;
    for (const candidate of query.observers) {
      const meta = candidate.options.meta?.workspaceFreshness as FreshnessMeta | undefined;
      const enabled =
        typeof candidate.options.enabled === "function"
          ? candidate.options.enabled(query)
          : candidate.options.enabled;
      if (!meta || !shown.has(meta.tabId) || enabled === false) continue;
      const previousInterval =
        typeof meta.interval === "function" ? meta.interval(query) : meta.interval;
      const staleTime =
        typeof candidate.options.staleTime === "function"
          ? candidate.options.staleTime(query)
          : (candidate.options.staleTime ?? 30_000);
      const running =
        typeof previousInterval === "number" && previousInterval > 0 && previousInterval <= 15_000;
      // Immutable files never poll; repo metadata keeps its slower expiry.
      if (!running && (staleTime === "static" || staleTime === Infinity)) continue;
      const normal =
        staleTime !== "static" && staleTime > 60_000
          ? staleTime
          : meta.tabId === focused
            ? 15_000
            : 60_000;
      const cadence = (running ? 3_000 : normal) * getRateBackoff(now);
      if (cadence < interval) {
        observer = candidate;
        interval = cadence;
      }
    }
    if (!observer || interval === Infinity) continue;
    const last = Math.max(query.state.dataUpdatedAt, query.state.errorUpdatedAt);
    if (last + interval <= now) requests.push(observer.refetch({ cancelRefetch: false }));
  }
  await Promise.all(requests);
}

function windowVisible() {
  return typeof document === "undefined" || document.visibilityState !== "hidden";
}

function visibleTabs(workspace: Workspace) {
  return new Set(
    islands(workspace.layout)
      .filter((island) => !workspace.maximizedIslandId || island.id === workspace.maximizedIslandId)
      .map((island) => island.selectedTabId),
  );
}

/** Lifecycle owned once by the workspace; query hooks never install competing polling timers. */
export function startWorkspaceFreshness(client: QueryClient): () => void {
  let queued = false;
  let stopped = false;
  const refresh = () => {
    if (queued || stopped) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      if (stopped) return;
      expireRateLimit();
      void refreshWorkspaceQueries(client, getWorkspace(), { visible: windowVisible() });
    });
  };
  const timer = setInterval(refresh, 1000);
  const cleanups = [
    client.getQueryCache().subscribe(refresh),
    useWorkspaceStore.subscribe(refresh),
    useRateLimitStore.subscribe(refresh),
    onlineManager.subscribe(refresh),
  ];
  document.addEventListener("visibilitychange", refresh);
  window.addEventListener("focus", refresh);
  refresh();
  return () => {
    stopped = true;
    clearInterval(timer);
    cleanups.forEach((stop) => {
      stop();
    });
    document.removeEventListener("visibilitychange", refresh);
    window.removeEventListener("focus", refresh);
  };
}
