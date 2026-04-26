import type { DashboardItem } from "@/app/features/dashboard/hooks";

// ─── Latency buckets ───────────────────────────────────────────────────────
//
// Two bands instead of one: how *recent* the item is (rough age bucket for
// grouping headers) and how *stale* it is from your perspective (a single
// urgency tone that drives the latency dot color on each row).
//
// The age axis uses created_at because we sort by it: it's the latency
// signal the dashboard exists to surface ("how long has this been waiting
// on me"). The stale axis is the same number, just bucketed for color.

const DAY_MS = 86_400_000;

export type AgeBucket = "today" | "week" | "older";
export type Stale = "fresh" | "warm" | "overdue" | "ancient";

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS);
}

export function ageBucket(iso: string): AgeBucket {
  const d = daysSince(iso);
  if (d < 1) return "today";
  if (d < 7) return "week";
  return "older";
}

export function staleness(iso: string): Stale {
  const d = daysSince(iso);
  if (d < 1) return "fresh";
  if (d < 3) return "warm";
  if (d < 14) return "overdue";
  return "ancient";
}

// ─── Group by age bucket ───────────────────────────────────────────────────
//
// Keeps insertion order within each bucket — the caller is expected to have
// already sorted (oldest-first for "Your turn", newest-first for "Open PRs").
// The returned shape is an ordered array so React keys stay stable and the
// header strings render in a predictable sequence.

export type AgeGroup = {
  bucket: AgeBucket;
  label: string;
  items: DashboardItem[];
};

const ORDER: AgeBucket[] = ["today", "week", "older"];

const LABELS: Record<AgeBucket, string> = {
  today: "Today",
  week: "This week",
  older: "Older",
};

export function groupByAge(
  items: readonly DashboardItem[],
  pickDate: (item: DashboardItem) => string,
): AgeGroup[] {
  const map = new Map<AgeBucket, DashboardItem[]>();
  for (const item of items) {
    const bucket = ageBucket(pickDate(item));
    const list = map.get(bucket) ?? [];
    list.push(item);
    map.set(bucket, list);
  }
  const groups: AgeGroup[] = [];
  for (const bucket of ORDER) {
    const list = map.get(bucket);
    if (list && list.length > 0) {
      groups.push({ bucket, label: LABELS[bucket], items: list });
    }
  }
  return groups;
}
