import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { useTabScope } from "@/app/lib/tabScope";
import { bucketBackoff, type RateResource, useRateLimitStore } from "@/app/stores/rateLimit";
import { useWorkspaceView } from "@/app/stores/workspaceView";
import { focusedTab, type Workspace } from "@/app/workspace/model";
import { useWorkspaceStore } from "@/app/workspace/store";
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
 * for use inside a `refetchInterval` callback or as a plain value:
 *
 *   const live = useLiveInterval("graphql");
 *   useQuery({ ..., refetchInterval: (q) => live(isRunning(q) ? "ci" : "changing") });
 *
 * Outside a tab (sidebar, title bar) the visible cadence applies.
 */
export function useLiveInterval(resource: RateResource = "core") {
  const level = useFreshnessLevel() ?? "visible";
  const backoff = useRateLimitStore((state) => bucketBackoff(state.buckets[resource]));
  return useCallback(
    (kind: LiveKind, floor?: number) => liveInterval(level, kind, { floor, backoff }),
    [level, backoff],
  );
}

/**
 * Focusing an island refreshes its stale data, just like returning to the
 * window: the same per-query rules (staleTime, refetchOnWindowFocus) decide
 * what refetches. Rendered once per tab, beside the page so the page itself
 * never re-renders on focus changes.
 */
export function IslandFocusRefresh() {
  const client = useQueryClient();
  const level = useFreshnessLevel();
  const previous = useRef(level);
  useEffect(() => {
    if (previous.current === "visible" && level === "focused") client.getQueryCache().onFocus();
    previous.current = level;
  }, [client, level]);
  return null;
}
