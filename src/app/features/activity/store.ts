import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TabStatus } from "./api";

export type ObservedStatus = TabStatus & { observedAt: number };
type ActivityState = {
  account: string | null;
  statuses: Record<string, ObservedStatus>;
  /** Verified GitHub viewer id → canonical page → last acknowledged activity. */
  seen: Record<string, Record<string, number>>;
};

export const useTabActivityStore = create<ActivityState>()(
  persist((): ActivityState => ({ account: null, statuses: {}, seen: {} }), {
    name: "githut.tab-activity.v1",
    partialize: (state) => ({ seen: state.seen }),
  }),
);

export function acknowledgePage(key: string, at: number) {
  rememberPage(key, Math.max(at, useTabActivityStore.getState().statuses[key]?.activityAt ?? 0));
}

function rememberPage(key: string, value: number) {
  const { account, seen } = useTabActivityStore.getState();
  if (!account) return;
  if ((seen[account]?.[key] ?? 0) >= value) return;
  // Bound persisted history without storing credentials or notification bodies.
  const { [key]: _, ...pages } = seen[account] ?? {};
  const entries = Object.entries(pages).slice(-499);
  const { [account]: _account, ...accounts } = seen;
  useTabActivityStore.setState({
    seen: {
      ...Object.fromEntries(Object.entries(accounts).slice(-4)),
      [account]: { ...Object.fromEntries(entries), [key]: value },
    },
  });
}

export function publishStatuses(
  account: string,
  items: TabStatus[],
  observedAt: number,
  views: Map<string, number>,
) {
  const current = useTabActivityStore.getState();
  const statuses = current.account === account ? { ...current.statuses } : {};
  for (const item of items) {
    const previous = statuses[item.key];
    const changed =
      item.fingerprint !== undefined &&
      previous?.fingerprint !== undefined &&
      item.fingerprint !== previous.fingerprint;
    statuses[item.key] = {
      ...item,
      activityAt: Math.max(item.activityAt, previous?.activityAt ?? 0, changed ? observedAt : 0),
      observedAt,
    };
  }
  useTabActivityStore.setState({ account, statuses });
  for (const [key, viewedAt] of views) rememberPage(key, viewedAt);
  for (const item of items) {
    const viewedAt = views.get(item.key);
    const seen = useTabActivityStore.getState().seen[account]?.[item.key];
    if (viewedAt !== undefined && viewedAt >= observedAt) acknowledgePage(item.key, viewedAt);
    else if (viewedAt !== undefined) rememberPage(item.key, viewedAt);
    else if (seen === undefined) {
      // First discovery establishes a baseline; don't label old history new.
      rememberPage(item.key, Math.max(observedAt, item.activityAt));
    }
  }
}
