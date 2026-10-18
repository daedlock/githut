import type { QueryCache } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { queryClient, refreshTabOnFocus } from "@/app/lib/query";
import { useTabScope } from "@/app/lib/tabScope";
import { getRateBackoff, type RateResource, useRateLimitStore } from "@/app/stores/rateLimit";
import { useWorkspaceView } from "@/app/stores/workspaceView";
import { focusedTab, type Workspace } from "@/app/workspace/model";
import { getWorkspace, useWorkspaceStore } from "@/app/workspace/store";
import { visibleTabIds } from "@/app/workspace/view";

// ─── Freshness (ADR 0003, spec #24 → Freshness) ──────────────────────────────
//
// TanStack Query stays in charge of freshness: stale data refetches on mount,
// on window focus, on reconnect and after invalidation, exactly as it would
// without islands. On top of that:
//
//   - Background tabs make no requests: <Activity mode="hidden"> tears down
//     their observers, and an unobserved query never polls.
//   - A hidden window pauses polling (TanStack's refetchIntervalInBackground
//     is false by default).
//   - Only queries that opt in poll on a timer, through `useLiveInterval`,
//     at a cadence set by where their tab is: about 15s in the focused tab,
//     about a minute in a visible one, and about 3s for running CI anywhere.
//     The hook's own floor always wins, so no query polls faster than its
//     author chose.
//   - Each live query names the GitHub rate-limit bucket it draws from. A low
//     bucket slows only its own queries 4×; an exhausted one pauses them.
//   - Focusing an island refreshes stale data the same way returning to the
//     window does (`IslandFocusRefresh`).
//   - A page never re-renders because its tab's level changed. Live queries
//     read the level when TanStack asks for their interval, and a level or
//     backoff change re-times the observed queries directly
//     (`retimeLiveQueries`). Re-rendering every page on each island focus
//     cost thousands of components in islands the user didn't touch.

export type FreshnessLevel = "focused" | "visible" | "background";

/** What kind of live data a query holds right now; `false` means it doesn't poll. */
export type LiveKind = "changing" | "ci" | false;

export const CADENCE = { focused: 15_000, visible: 60_000, ci: 3_000 } as const;

export function freshnessLevel(
  workspace: Workspace,
  narrow: boolean,
  tabId: string,
): FreshnessLevel {
  if (!visibleTabIds(workspace, narrow).has(tabId)) return "background";
  return focusedTab(workspace).id === tabId ? "focused" : "visible";
}

/** The level of the tab this component renders in; null outside tabs (sidebar, title bar). */
export function useFreshnessLevel(): FreshnessLevel | null {
  const { tabId } = useTabScope();
  const narrow = useWorkspaceView((state) => state.narrow);
  return useWorkspaceStore((state) =>
    tabId ? freshnessLevel(state.workspace, narrow, tabId) : null,
  );
}

/** A `refetchInterval` value: the level's cadence, never faster than `floor`, times the backoff. */
export function liveInterval(
  level: FreshnessLevel,
  kind: LiveKind,
  { floor = 0, backoff = 1 }: { floor?: number; backoff?: number } = {},
): number | false {
  if (!kind || level === "background" || !Number.isFinite(backoff)) return false;
  const cadence =
    kind === "ci" ? CADENCE.ci : level === "focused" ? CADENCE.focused : CADENCE.visible;
  return Math.max(cadence, floor) * backoff;
}

/**
 * Opt a query in to live polling. Returns `(kind, floor?) => refetchInterval`
 * to call inside a `refetchInterval` callback, never at render:
 *
 *   const live = useLiveInterval("graphql");
 *   useQuery({ ..., refetchInterval: (q) => live(isRunning(q) ? "ci" : "changing") });
 *
 * The level and backoff are read when TanStack calls it, so the component
 * subscribes to nothing; `followFreshness` re-times queries when either
 * changes. Outside a tab (sidebar, title bar) the visible cadence applies.
 */
export function useLiveInterval(resource: RateResource = "core") {
  const { tabId } = useTabScope();
  useEffect(followFreshness, []);
  return useCallback(
    (kind: LiveKind, floor?: number) =>
      liveInterval(currentLevel(tabId), kind, { floor, backoff: getRateBackoff(resource) }),
    [tabId, resource],
  );
}

function currentLevel(tabId: string | null | undefined): FreshnessLevel {
  return tabId
    ? freshnessLevel(getWorkspace(), useWorkspaceView.getState().narrow, tabId)
    : "visible";
}

/**
 * Re-evaluate the refetch interval of every observed query in `cache`, as
 * TanStack does when options change, without touching React. Unobserved
 * queries (background tabs) have no timer to re-time.
 */
export function retimeLiveQueries(cache: QueryCache) {
  for (const query of cache.getAll()) {
    // Same options: no fetch, no result change, only the timer is re-checked.
    for (const observer of query.observers) observer.setOptions(observer.options);
  }
}

/** Where tabs sit: the focused tab and the visible ones. Changes exactly when a level does. */
function levelKey(workspace: Workspace, narrow: boolean): string {
  return `${focusedTab(workspace).id}|${[...visibleTabIds(workspace, narrow)].sort().join(",")}`;
}

let following = false;

/** Once per window: re-time live queries whenever a tab's level or a bucket's backoff changes. */
function followFreshness() {
  if (following) return;
  following = true;
  let key = levelKey(getWorkspace(), useWorkspaceView.getState().narrow);
  const levelsChanged = () => {
    const next = levelKey(getWorkspace(), useWorkspaceView.getState().narrow);
    if (next === key) return;
    key = next;
    retimeLiveQueries(queryClient.getQueryCache());
  };
  useWorkspaceStore.subscribe(levelsChanged);
  useWorkspaceView.subscribe(levelsChanged);
  useRateLimitStore.subscribe((state, prev) => {
    if (state.buckets !== prev.buckets) retimeLiveQueries(queryClient.getQueryCache());
  });
}

/**
 * Focusing an island refreshes that tab's stale data, just like returning to
 * the window: the same per-query rules (staleTime, refetchOnWindowFocus)
 * decide what refetches. Other islands on screen are left alone. Rendered
 * once per tab, beside the page so the page never re-renders on focus changes.
 */
export function IslandFocusRefresh() {
  const { tabId } = useTabScope();
  const level = useFreshnessLevel();
  const previous = useRef(level);
  useEffect(() => {
    if (tabId && previous.current === "visible" && level === "focused") refreshTabOnFocus(tabId);
    previous.current = level;
  }, [tabId, level]);
  return null;
}
