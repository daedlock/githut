import { useMemo } from "react";
import { StatusDot, type StatusPillVariant } from "@/app/components/ui/StatusPill";
import { cn } from "@/app/lib/cn";

// ─── Timeline primitive ────────────────────────────────────────────────────
//
// A horizontal Gantt-style timeline: each item has a start/end time and a
// status variant. The component auto-ranges the time axis from the items'
// earliest start to latest end (or `now` for in-progress items), maps each
// item to a proportional bar, and renders labels to the left.
//
// Not specific to Actions — same primitive works for deploys, commit
// activity, PR-review turnaround, anything with (start, end, status, label).

export type TimelineItem = {
  id: string;
  label: string;
  /** ISO timestamp — item's start. */
  start: string;
  /** ISO timestamp — item's end. Pass `null` for in-progress items. */
  end: string | null;
  status: StatusPillVariant;
  /** Optional hover tooltip override. Defaults to label + duration. */
  tooltip?: string;
};

export type TimelineProps = {
  items: TimelineItem[];
  /** Fires when an item is clicked. */
  onSelect?: (id: string) => void;
  /** Which item to mark as selected. */
  selectedId?: string | null;
  /** Left-column width for labels. Tuned for typical job names. */
  labelWidth?: number;
  /** Bar height; also sets row height. Default 20px. */
  barHeight?: number;
  className?: string;
};

export function Timeline({
  items,
  onSelect,
  selectedId,
  labelWidth = 160,
  barHeight = 20,
  className,
}: TimelineProps) {
  const { min, max } = useMemo(() => rangeOf(items), [items]);

  if (items.length === 0) return null;

  const span = Math.max(1, max - min);

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-md border border-border bg-(--color-bg-subtle)",
        className,
      )}
      role="list"
      aria-label="Timeline"
    >
      {items.map((item) => {
        const startMs = new Date(item.start).getTime();
        const endMs = item.end ? new Date(item.end).getTime() : max;
        const leftPct = ((startMs - min) / span) * 100;
        // Minimum visible width — a just-started live job or a sub-second
        // step would otherwise render as a thin sliver. 2% of the track keeps
        // the bar discoverable without significantly distorting long items.
        const widthPct = Math.max(2, ((endMs - startMs) / span) * 100);
        const isSelected = selectedId === item.id;

        return (
          <button
            key={item.id}
            type="button"
            role="listitem"
            onClick={() => onSelect?.(item.id)}
            title={item.tooltip ?? `${item.label} — ${formatDuration(endMs - startMs)}`}
            className={cn(
              "group flex w-full items-center gap-2 border-b border-border px-2 text-left outline-none",
              "transition-colors last:border-b-0",
              "hover:bg-(--color-bg-sunken)",
              "focus-visible:bg-(--color-bg-sunken)",
              isSelected && "bg-(--color-bg-sunken)",
            )}
            style={{ height: barHeight + 12 }}
          >
            <div
              className="flex shrink-0 items-center gap-1.5 truncate font-mono text-caption text-foreground"
              style={{ width: labelWidth }}
            >
              <StatusDot variant={item.status} />
              <span className="truncate">{item.label}</span>
            </div>

            <div className="relative h-full min-w-0 flex-1">
              <span
                aria-hidden
                className={cn(
                  "absolute top-1/2 -translate-y-1/2 rounded-sm",
                  barFill(item.status),
                  item.end === null && "animate-pulse",
                )}
                style={{
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  height: barHeight,
                }}
              />
            </div>

            <span className="shrink-0 font-mono text-micro tabular-nums text-muted-foreground">
              {formatDuration(endMs - startMs)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function rangeOf(items: TimelineItem[]): { min: number; max: number } {
  if (items.length === 0) return { min: 0, max: 0 };
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  const now = Date.now();
  for (const it of items) {
    const s = new Date(it.start).getTime();
    const e = it.end ? new Date(it.end).getTime() : now;
    if (s < min) min = s;
    if (e > max) max = e;
  }
  return { min, max };
}

function barFill(variant: StatusPillVariant): string {
  switch (variant) {
    case "success":
      return "bg-(--color-success)";
    case "failure":
      return "bg-(--color-danger)";
    case "running":
      return "bg-(--color-warning)";
    case "queued":
      return "bg-(--color-fg-faint)";
    case "cancelled":
    case "skipped":
    case "neutral":
      return "bg-(--color-fg-faint)";
  }
}

/**
 * Format an elapsed millisecond duration as `1m 23s` / `45s` / `2h 3m`.
 * Intentionally concise — this sits inside a dense row.
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
