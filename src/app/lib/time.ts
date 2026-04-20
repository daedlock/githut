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
