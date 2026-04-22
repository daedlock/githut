import { useMemo } from "react";
import type { StatusPillVariant } from "@/app/components/ui/StatusPill";
import { cn } from "@/app/lib/cn";

// ─── Timeline ──────────────────────────────────────────────────────────────
//
// A dependency/waterfall view. Each row is one item, plotted on a shared
// time axis with a vertical connector line threading through the status
// nodes on the left — reads as a sequence, not a bar chart. Tones are
// deliberately muted: success and skipped recede into the chrome;
// failure + running keep saturation because they're actionable signals
// that need to pop.
//
// Not specific to Actions — any (start, end, status, label) set works.

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
  onSelect?: (id: string) => void;
  selectedId?: string | null;
  /** Left-column width for the connector + label. */
  labelWidth?: number;
  /** Right-column width for duration labels. */
  durationWidth?: number;
  /**
   * Current wall-clock time in ms — used as the `end` for in-progress items.
   * Pass a ticking value (e.g. from `useNow()`) when items are live.
   */
  now?: number;
  className?: string;
};

const ROW_HEIGHT = 32;
const NODE_SIZE = 8; // px

export function Timeline({
  items,
  onSelect,
  selectedId,
  labelWidth = 200,
  durationWidth = 64,
  now,
  className,
}: TimelineProps) {
  const resolvedNow = now ?? Date.now();
  const { min, max } = useMemo(() => rangeOf(items, resolvedNow), [items, resolvedNow]);

  if (items.length === 0) return null;

  const span = Math.max(1, max - min);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border border-border bg-(--color-bg-subtle)",
        className,
      )}
      role="list"
      aria-label="Timeline"
    >
      {items.map((item, i) => {
        const startMs = new Date(item.start).getTime();
        const endMs = item.end ? new Date(item.end).getTime() : max;
        const leftPct = ((startMs - min) / span) * 100;
        const widthPct = Math.max(1.5, ((endMs - startMs) / span) * 100);
        const isSelected = selectedId === item.id;
        const isLive = item.end === null;
        const isFirst = i === 0;
        const isLast = i === items.length - 1;

        return (
          <button
            key={item.id}
            type="button"
            role="listitem"
            onClick={() => onSelect?.(item.id)}
            title={item.tooltip ?? `${item.label} — ${formatDuration(endMs - startMs)}`}
            className={cn(
              "group flex w-full items-center text-left outline-none",
              "hover:bg-(--color-bg-sunken)",
              "focus-visible:bg-(--color-bg-sunken)",
              isSelected && "bg-(--color-bg-sunken)",
            )}
            style={{ height: ROW_HEIGHT }}
          >
            {/* Connector + label column */}
            <div
              className="flex h-full shrink-0 items-center gap-2"
              style={{ width: labelWidth }}
            >
              {/* Connector node — threaded through the column via flex-col */}
              <div className="relative flex h-full w-6 shrink-0 flex-col items-center justify-center pl-3">
                {/* top stem */}
                <span
                  aria-hidden
                  className={cn(
                    "w-px flex-1 bg-border",
                    isFirst && "invisible",
                  )}
                />
                {/* node */}
                <span
                  aria-hidden
                  className={cn(
                    "my-0.5 block rounded-full ring-2 ring-(--color-bg-subtle)",
                    nodeTone(item.status),
                    isLive && "animate-pulse",
                  )}
                  style={{ width: NODE_SIZE, height: NODE_SIZE }}
                />
                {/* bottom stem */}
                <span
                  aria-hidden
                  className={cn(
                    "w-px flex-1 bg-border",
                    isLast && "invisible",
                  )}
                />
              </div>

              <span className="truncate font-mono text-caption text-foreground">
                {item.label}
              </span>
            </div>

            {/* Bar track */}
            <div className="relative h-full flex-1">
              <span
                aria-hidden
                className={cn(
                  "absolute top-1/2 -translate-y-1/2 h-[6px] rounded-[2px]",
                  barFill(item.status),
                  isLive && "animate-pulse",
                )}
                style={{
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                }}
              />
            </div>

            {/* Duration column */}
            <div
              className="shrink-0 pr-3 text-right font-mono text-micro tabular-nums text-muted-foreground"
              style={{ width: durationWidth }}
            >
              {formatTickLabel(endMs - startMs)}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Tones ─────────────────────────────────────────────────────────────────
//
// Muted tones for "background" states (success / skipped / queued / neutral)
// — they shouldn't scream. Failure and running keep saturation because
// they carry actionable signal. Bars are mixed against the subtle bg so
// they tint but don't dominate.

function barFill(variant: StatusPillVariant): string {
  switch (variant) {
    case "success":
      return "bg-[color-mix(in_oklab,var(--color-fg-muted)_55%,var(--color-bg-subtle))]";
    case "failure":
      return "bg-[color-mix(in_oklab,var(--color-danger)_75%,var(--color-bg-subtle))]";
    case "running":
      return "bg-[color-mix(in_oklab,var(--color-warning)_70%,var(--color-bg-subtle))]";
    case "queued":
      return "bg-[color-mix(in_oklab,var(--color-fg-faint)_50%,var(--color-bg-subtle))]";
    case "cancelled":
    case "skipped":
    case "neutral":
      return "bg-[color-mix(in_oklab,var(--color-fg-faint)_35%,var(--color-bg-subtle))]";
  }
}

function nodeTone(variant: StatusPillVariant): string {
  switch (variant) {
    case "success":
      return "bg-(--color-fg-muted)";
    case "failure":
      return "bg-(--color-danger)";
    case "running":
      return "bg-(--color-warning)";
    case "queued":
      return "bg-(--color-fg-muted)";
    case "cancelled":
    case "skipped":
    case "neutral":
      return "bg-(--color-fg-faint)";
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function rangeOf(items: TimelineItem[], now: number): { min: number; max: number } {
  if (items.length === 0) return { min: 0, max: 0 };
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const it of items) {
    const s = new Date(it.start).getTime();
    const e = it.end ? new Date(it.end).getTime() : now;
    if (s < min) min = s;
    if (e > max) max = e;
  }
  return { min, max };
}

/**
 * Compact duration format for the tight right-column label.
 *   <60s → "42s"
 *   <60m → "3m"
 *   else → "2h"
 */
export function formatTickLabel(ms: number): string {
  if (ms < 0 || !Number.isFinite(ms)) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  return `${h}h`;
}

/**
 * Full duration format — used by hover tooltips and callers that want
 * precision ("1m 15s" rather than rounded "1m").
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
