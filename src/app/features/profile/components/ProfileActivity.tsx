import { Activity } from "lucide-react";
import { useMemo, useState } from "react";
import { Skeleton } from "@/app/components/ui/skeleton";
import { cn } from "@/app/lib/cn";
import type { GitHubEvent } from "../schemas";

const WEEKS = 13; // last 13 weeks (~91 days) — matches the events window
const DAYS = 7;
const LEVELS = 5; // 0..4

export type ProfileActivityProps = {
  events: GitHubEvent[] | undefined;
  isLoading: boolean;
};

type Cell = {
  /** Local YYYY-MM-DD */
  key: string;
  /** Sun=0..Sat=6 */
  dow: number;
  count: number;
  level: number; // 0..4
  date: Date;
};

/**
 * Public activity heatmap — 13 weeks × 7 days, color levels mixed from
 * `--color-accent` so it harmonises with whatever theme is active.
 *
 * No native tooltips: hovering a cell updates an inline scrubber line that
 * sits below the grid. That keeps focus on a single, calm read-out instead
 * of 91 stacked title popups.
 */
export function ProfileActivity({ events, isLoading }: ProfileActivityProps) {
  const data = useMemo(() => buildMatrix(events), [events]);
  const [hovered, setHovered] = useState<Cell | null>(null);

  if (isLoading) return <ActivitySkeleton />;

  const summary = data.summary;

  return (
    <section
      aria-label="Public activity"
      className="flex flex-col gap-4 rounded-xl bg-muted px-4 py-4 sm:px-5 sm:py-5"
    >
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="flex items-center gap-1.5 font-mono text-micro uppercase tracking-widest text-muted-foreground">
          <Activity
            className="size-3 text-[color:var(--color-fg-faint)]"
            aria-hidden
          />
          Public activity
        </h2>
        <span className="font-mono text-micro tabular-nums text-[color:var(--color-fg-faint)]">
          Last 13 weeks
        </span>
      </header>

      {summary.total === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Heatmap grid */}
          <div className="flex items-start gap-2 overflow-x-auto pb-1">
            {/* Day labels (Mon, Wed, Fri) */}
            <div
              className="grid shrink-0 grid-rows-7 gap-[3px] pt-px font-mono text-[10px] uppercase leading-none text-[color:var(--color-fg-faint)]"
              aria-hidden
            >
              <span />
              <span>Mon</span>
              <span />
              <span>Wed</span>
              <span />
              <span>Fri</span>
              <span />
            </div>

            {/* Cells — chronological by week, grid-flow-col + 7 rows */}
            <div
              className="grid shrink-0 grid-flow-col grid-rows-7 gap-[3px]"
              onMouseLeave={() => setHovered(null)}
            >
              {data.cells.map((cell) => (
                <button
                  key={cell.key}
                  type="button"
                  aria-label={`${cell.count} events on ${formatDateLabel(cell.date)}`}
                  onMouseEnter={() => setHovered(cell)}
                  onFocus={() => setHovered(cell)}
                  className={cn(
                    "size-[14px] rounded-[3px] outline-none transition-transform",
                    "hover:scale-110 focus-visible:ring-2 focus-visible:ring-[color:var(--color-focus)]",
                  )}
                  style={{ backgroundColor: levelColor(cell.level) }}
                />
              ))}
            </div>
          </div>

          {/* Scrubber + legend row */}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p
              className="font-mono text-caption text-muted-foreground"
              aria-live="polite"
            >
              {hovered ? (
                <>
                  <span className="font-medium tabular-nums text-foreground">
                    {hovered.count}
                  </span>{" "}
                  {hovered.count === 1 ? "event" : "events"}{" "}
                  <span className="text-[color:var(--color-fg-faint)]">·</span>{" "}
                  <span>{formatDateLabel(hovered.date)}</span>
                </>
              ) : (
                <>
                  <span className="font-medium tabular-nums text-foreground">
                    {summary.total}
                  </span>{" "}
                  events{" "}
                  <span className="text-[color:var(--color-fg-faint)]">·</span>{" "}
                  <span>{summary.activeDays} active days</span>
                  {summary.bestDay && (
                    <>
                      {" "}
                      <span className="text-[color:var(--color-fg-faint)]">·</span>{" "}
                      best{" "}
                      <span className="tabular-nums text-foreground">
                        {summary.bestDay.count}
                      </span>{" "}
                      on {formatDateLabel(summary.bestDay.date)}
                    </>
                  )}
                </>
              )}
            </p>

            <Legend />
          </div>
        </>
      )}
    </section>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-[color:var(--color-fg-faint)]">
      <span>Less</span>
      <span className="flex items-center gap-[3px]">
        {Array.from({ length: LEVELS }).map((_, i) => (
          <span
            key={i}
            className="size-2.5 rounded-[2px]"
            style={{ backgroundColor: levelColor(i) }}
          />
        ))}
      </span>
      <span>More</span>
    </div>
  );
}

function EmptyState() {
  return (
    <p className="py-6 text-center font-mono text-caption text-[color:var(--color-fg-faint)]">
      No public activity in the last 90 days
    </p>
  );
}

function ActivitySkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-xl bg-muted px-4 py-4 sm:px-5 sm:py-5">
      <div className="flex items-baseline justify-between">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-[110px] w-full rounded-md" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

// ─── Math ───────────────────────────────────────────────────────────────────

function levelColor(level: number): string {
  if (level <= 0) return "var(--color-bg-sunken)";
  // 1..4 mix from --color-accent into --color-bg-subtle so the palette swap
  // (ember / dune / sand / dark) cascades automatically.
  const ramp = [25, 45, 65, 90];
  const pct = ramp[Math.min(LEVELS - 2, level - 1)] ?? 90;
  return `color-mix(in oklab, var(--color-accent) ${pct}%, var(--color-bg-subtle))`;
}

function localKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateLabel(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function buildMatrix(events: GitHubEvent[] | undefined): {
  cells: Cell[];
  summary: {
    total: number;
    activeDays: number;
    bestDay: { date: Date; count: number } | null;
  };
} {
  const counts = new Map<string, number>();
  if (events) {
    for (const ev of events) {
      if (!ev.created_at) continue;
      const d = new Date(ev.created_at);
      if (Number.isNaN(d.getTime())) continue;
      const key = localKey(d);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  // Build cells from (today - WEEKS*7 + 1) snapped back to start-of-week (Sun)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - (WEEKS * DAYS - 1));
  start.setDate(start.getDate() - start.getDay()); // snap to Sunday

  const cells: Cell[] = [];
  const cursor = new Date(start);
  let max = 0;
  while (cursor <= today) {
    const key = localKey(cursor);
    const count = counts.get(key) ?? 0;
    if (count > max) max = count;
    cells.push({
      key,
      dow: cursor.getDay(),
      count,
      level: 0, // filled in below
      date: new Date(cursor),
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  // Quantile-style level assignment: 0 = no activity, 1..4 spread by max.
  for (const c of cells) {
    if (c.count === 0) {
      c.level = 0;
      continue;
    }
    if (max <= 1) {
      c.level = 1;
      continue;
    }
    // 4 bands above zero
    const ratio = c.count / max;
    if (ratio >= 0.75) c.level = 4;
    else if (ratio >= 0.5) c.level = 3;
    else if (ratio >= 0.25) c.level = 2;
    else c.level = 1;
  }

  let total = 0;
  let activeDays = 0;
  let bestDay: { date: Date; count: number } | null = null;
  for (const c of cells) {
    total += c.count;
    if (c.count > 0) activeDays += 1;
    if (!bestDay || c.count > bestDay.count) {
      if (c.count > 0) bestDay = { date: c.date, count: c.count };
    }
  }

  return { cells, summary: { total, activeDays, bestDay } };
}
