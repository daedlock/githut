import {
  Activity,
  CircleDot,
  GitCommit,
  GitFork,
  GitPullRequest,
  type LucideIcon,
  MessageSquare,
  Plus,
  Star,
  Tag,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Skeleton } from "@/app/components/ui/skeleton";
import { cn } from "@/app/lib/cn";
import type { GitHubEvent } from "../schemas";

const TOTAL_DAYS = 30;
const GAP_PX = 3;
const LEVELS = 5;
// Older cells fade toward transparent — time recedes leftward.
const OPACITY_FLOOR = 0.55;

type Bucket = "push" | "pr" | "issue" | "review" | "star" | "fork" | "release" | "create" | "other";

const BUCKET: Record<Bucket, { icon: LucideIcon; one: string; many: string }> = {
  push: { icon: GitCommit, one: "push", many: "pushes" },
  pr: { icon: GitPullRequest, one: "PR", many: "PRs" },
  issue: { icon: CircleDot, one: "issue", many: "issues" },
  review: { icon: MessageSquare, one: "review", many: "reviews" },
  star: { icon: Star, one: "star", many: "stars" },
  fork: { icon: GitFork, one: "fork", many: "forks" },
  release: { icon: Tag, one: "release", many: "releases" },
  create: { icon: Plus, one: "create", many: "creates" },
  other: { icon: Activity, one: "event", many: "events" },
};

type DayCell = {
  key: string;
  date: Date;
  isToday: boolean;
  count: number;
  level: number;
  buckets: Map<Bucket, number>;
  label: string;
};

type Summary = {
  total: number;
  activeDays: number;
  bestDay: { count: number; label: string } | null;
};

export type ProfileActivityProps = {
  events: GitHubEvent[] | undefined;
  isLoading: boolean;
};

/**
 * Activity pulse-line. Not a card — a flat band on the page surface, sitting
 * inline in the profile flow as architecture rather than as a widget.
 *
 * Three creative moves on top of the heatmap base:
 *   - Temporal opacity gradient: older cells fade left, present sharpens right.
 *   - Active cells emit an ambient glow proportional to their level.
 *   - Today's cell breathes a quiet pulse so the present anchors the eye.
 *
 * Caption beneath morphs from aggregate stats to typed event-breakdown when
 * a cell is hovered or pinned. Click to pin.
 */
export function ProfileActivity({ events, isLoading }: ProfileActivityProps) {
  const data = useMemo(() => buildRibbon(events), [events]);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [pinnedKey, setPinnedKey] = useState<string | null>(null);

  if (isLoading) return <ActivitySkeleton />;

  const activeKey = pinnedKey ?? hoveredKey;
  const active = activeKey ? (data.byKey.get(activeKey) ?? null) : null;
  const isPinned = !!pinnedKey;

  return (
    <div aria-label="Public activity" className="flex flex-col gap-2.5" role="group">
      {data.summary.total === 0 ? (
        <p className="text-caption text-(--color-fg-faint)">no public events in the last 30 days</p>
      ) : (
        <>
          <div
            className="grid"
            role="grid"
            aria-label="Activity ribbon"
            onMouseLeave={() => setHoveredKey(null)}
            style={{
              gridTemplateColumns: `repeat(${TOTAL_DAYS}, minmax(0, 1fr))`,
              gap: `${GAP_PX}px`,
            }}
          >
            {data.cells.map((cell, i) => {
              const isActive = active?.key === cell.key;
              const ageOpacity = OPACITY_FLOOR + (1 - OPACITY_FLOOR) * (i / (TOTAL_DAYS - 1));
              return (
                <button
                  key={cell.key}
                  type="button"
                  role="gridcell"
                  aria-label={`${cell.count} ${
                    cell.count === 1 ? "event" : "events"
                  } on ${cell.label}`}
                  aria-pressed={isPinned ? isActive : undefined}
                  data-active={isActive || undefined}
                  onMouseEnter={() => setHoveredKey(cell.key)}
                  onFocus={() => setHoveredKey(cell.key)}
                  onBlur={() => {
                    if (!pinnedKey) setHoveredKey(null);
                  }}
                  onClick={() => setPinnedKey((p) => (p === cell.key ? null : cell.key))}
                  style={{
                    aspectRatio: "1 / 1",
                    backgroundColor: levelColor(cell.level),
                    boxShadow: glowFor(cell.level),
                    opacity: ageOpacity,
                    animationDelay: `${i * 12}ms`,
                  }}
                  className={cn(
                    "w-full rounded-[5px] outline-none activity-cell-in",
                    "transition-[transform,box-shadow,opacity] duration-150 ease-out",
                    "hover:scale-[1.12] hover:z-10 hover:!opacity-100",
                    "focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-[color:var(--color-focus)] focus-visible:!opacity-100",
                    "data-[active]:z-10 data-[active]:scale-[1.12] data-[active]:ring-2 data-[active]:ring-[color:var(--color-focus)] data-[active]:!opacity-100",
                    cell.isToday && "activity-today-pulse",
                  )}
                />
              );
            })}
          </div>

          <p className="text-caption text-muted-foreground" aria-live="polite">
            {active ? (
              <ActiveLine cell={active} pinned={isPinned} />
            ) : (
              <SummaryLine summary={data.summary} />
            )}
          </p>
        </>
      )}
    </div>
  );
}

// ─── Caption variants ─────────────────────────────────────────────────────

function SummaryLine({ summary }: { summary: Summary }) {
  return (
    <span className="block truncate">
      <span className="font-medium tabular-nums text-foreground">{summary.total}</span> events{" "}
      <span className="text-[color:var(--color-fg-faint)]">·</span>{" "}
      <span className="tabular-nums">{summary.activeDays}</span> active days
      {summary.bestDay && (
        <>
          {" "}
          <span className="text-[color:var(--color-fg-faint)]">·</span> best{" "}
          <span className="tabular-nums text-foreground">{summary.bestDay.count}</span> on{" "}
          {summary.bestDay.label}
        </>
      )}{" "}
      <span className="text-[color:var(--color-fg-faint)]">·</span>{" "}
      <span className="text-[color:var(--color-fg-faint)]">last 30 days</span>
    </span>
  );
}

function ActiveLine({ cell, pinned }: { cell: DayCell; pinned: boolean }) {
  const buckets = useMemo(
    () => [...cell.buckets.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3),
    [cell],
  );

  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-0">
      {pinned && (
        <span
          aria-label="pinned"
          className="size-1.5 rounded-full"
          style={{ backgroundColor: "var(--color-success)" }}
        />
      )}
      <span className="text-foreground">{cell.label}</span>
      <span className="text-[color:var(--color-fg-faint)]">·</span>
      <span>
        <span className="font-medium tabular-nums text-foreground">{cell.count}</span>{" "}
        {cell.count === 1 ? "event" : "events"}
      </span>
      {buckets.length > 0 && <span className="text-[color:var(--color-fg-faint)]">·</span>}
      {buckets.map(([key, n], idx) => {
        const meta = BUCKET[key];
        const Icon = meta.icon;
        return (
          <span key={key} className="flex items-center gap-1">
            {idx > 0 && <span className="text-[color:var(--color-fg-faint)]">·</span>}
            <Icon className="size-3 text-[color:var(--color-fg-faint)]" aria-hidden />
            <span>
              <span className="tabular-nums text-foreground">{n}</span>{" "}
              {n === 1 ? meta.one : meta.many}
            </span>
          </span>
        );
      })}
    </span>
  );
}

function ActivitySkeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      <Skeleton className="aspect-[30/1] w-full rounded-md" />
      <Skeleton className="h-3 w-3/5" />
    </div>
  );
}

// ─── Math ───────────────────────────────────────────────────────────────────

function levelColor(level: number): string {
  if (level <= 0) return "var(--color-bg-sunken)";
  const ramp = [25, 45, 65, 90];
  const pct = ramp[Math.min(LEVELS - 2, level - 1)] ?? 90;
  return `color-mix(in oklab, var(--color-success) ${pct}%, var(--color-bg-subtle))`;
}

/**
 * Ambient glow halo for active cells. Mixes the success hue into transparent
 * via box-shadow so high-activity days luminesce above the page surface.
 * Quiet days (level 0–1) emit nothing — they recede flat. Activity is
 * "additions" semantically, which is why this uses --color-success rather
 * than the brand accent.
 */
function glowFor(level: number): string | undefined {
  if (level < 2) return undefined;
  const radius = level === 2 ? 6 : level === 3 ? 9 : 12;
  const intensity = level === 2 ? 18 : level === 3 ? 26 : 34;
  return `0 0 ${radius}px 0 color-mix(in oklab, var(--color-success) ${intensity}%, transparent)`;
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

function eventBucket(type: string | null): Bucket {
  switch (type) {
    case "PushEvent":
      return "push";
    case "PullRequestEvent":
      return "pr";
    case "PullRequestReviewEvent":
    case "PullRequestReviewCommentEvent":
      return "review";
    case "IssuesEvent":
    case "IssueCommentEvent":
      return "issue";
    case "WatchEvent":
      return "star";
    case "ForkEvent":
      return "fork";
    case "ReleaseEvent":
      return "release";
    case "CreateEvent":
      return "create";
    default:
      return "other";
  }
}

function buildRibbon(events: GitHubEvent[] | undefined): {
  cells: DayCell[];
  byKey: Map<string, DayCell>;
  summary: Summary;
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = localKey(today);

  const cells: DayCell[] = [];
  const byKey = new Map<string, DayCell>();
  for (let i = 0; i < TOTAL_DAYS; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - (TOTAL_DAYS - 1 - i));
    const key = localKey(date);
    const cell: DayCell = {
      key,
      date,
      isToday: key === todayKey,
      count: 0,
      level: 0,
      buckets: new Map(),
      label: formatDateLabel(date),
    };
    cells.push(cell);
    byKey.set(key, cell);
  }

  if (events) {
    for (const ev of events) {
      if (!ev.created_at) continue;
      const d = new Date(ev.created_at);
      if (Number.isNaN(d.getTime())) continue;
      const cell = byKey.get(localKey(d));
      if (!cell) continue;
      cell.count += 1;
      const bucket = eventBucket(ev.type ?? null);
      cell.buckets.set(bucket, (cell.buckets.get(bucket) ?? 0) + 1);
    }
  }

  let max = 0;
  for (const c of cells) if (c.count > max) max = c.count;
  for (const c of cells) {
    if (c.count === 0) c.level = 0;
    else if (max <= 1) c.level = 1;
    else {
      const ratio = c.count / max;
      if (ratio >= 0.75) c.level = 4;
      else if (ratio >= 0.5) c.level = 3;
      else if (ratio >= 0.25) c.level = 2;
      else c.level = 1;
    }
  }

  let total = 0;
  let activeDays = 0;
  let bestDay: Summary["bestDay"] = null;
  for (const c of cells) {
    total += c.count;
    if (c.count > 0) activeDays += 1;
    if (c.count > 0 && (!bestDay || c.count > bestDay.count)) {
      bestDay = { count: c.count, label: c.label };
    }
  }

  return { cells, byKey, summary: { total, activeDays, bestDay } };
}
