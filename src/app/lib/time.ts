/**
 * formatRelativeTime — compact "time ago" string for UI timestamps.
 *
 * Returns: "Xs ago" / "Xm ago" / "Xh ago" / "Xd ago" for values < 30 days,
 * otherwise an ISO date (YYYY-MM-DD). Used in issue/PR rows, comment headers.
 *
 * Separate from FileList's relativeTime (which uses "just now" + months/years)
 * because the two UIs have different grain needs; do not merge without
 * verifying both callers.
 */
export function formatRelativeTime(dateIso: string): string {
  const diff = Date.now() - new Date(dateIso).getTime();
  const sec = Math.max(0, Math.floor(diff / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(dateIso).toISOString().slice(0, 10);
}

/**
 * formatFullDate — long-form "Jan 5, 2024" used for commit list day headers
 * and anywhere we want the full date spelled out, not the relative one.
 */
export function formatFullDate(dateIso: string): string {
  return new Date(dateIso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * dayKey — stable YYYY-MM-DD key for grouping items by calendar day in the
 * user's local timezone. Same instant can produce different keys across
 * timezones; we intentionally use local so "today" matches the reader's day.
 */
export function dayKey(dateIso: string): string {
  const d = new Date(dateIso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * groupByDay — given an array of items with a date, group them by local-day
 * while preserving input order within each group. Returns groups in the order
 * their first item appeared (commit lists arrive newest-first, so that gives
 * the expected top-to-bottom chronological display).
 */
export function groupByDay<T>(
  items: readonly T[],
  getDateIso: (item: T) => string,
): Array<{ key: string; iso: string; items: T[] }> {
  const groups = new Map<string, { key: string; iso: string; items: T[] }>();
  for (const item of items) {
    const iso = getDateIso(item);
    const key = dayKey(iso);
    let group = groups.get(key);
    if (!group) {
      group = { key, iso, items: [] };
      groups.set(key, group);
    }
    group.items.push(item);
  }
  return [...groups.values()];
}

/**
 * formatDuration — precise elapsed time ("42s", "1m 15s", "2h 5m") for run,
 * job and step durations.
 */
export function formatDuration(ms: number): string {
  if (ms < 0 || !Number.isFinite(ms)) return "—";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return rs > 0 ? `${m}m ${rs}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
}
