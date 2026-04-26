import { Link } from "@tanstack/react-router";
import { CircleDot } from "lucide-react";
import { PrStateIcon } from "@/app/features/pulls/components/PrStatePill";
import { toUiState } from "@/app/features/pulls/lib/prStatus";
import type { DashboardItem, DashboardReason } from "@/app/features/dashboard/hooks";
import { staleness, type Stale } from "@/app/features/dashboard/lib/buckets";
import { cn } from "@/app/lib/cn";
import { formatRelativeTime } from "@/app/lib/time";

// ─── DashRow ──────────────────────────────────────────────────────────────
//
// One unified compact row for every dashboard list. Single horizontal line:
//
//   [●] [icon]  alice/api  Add retry policy        REVIEW  2d
//
// Left edge holds a 6px latency dot whose tone derives from the row's age
// (fresh → faint, waiting → warning, overdue → danger). That single mark
// is the dashboard's urgency cue — the rest of the row stays neutral so the
// dot reads at a glance across a dense list.
//
// `showReason` toggles the reason chip ("REVIEW" / "ASSIGNED" / "MENTIONED"):
// turned on for the "Awaiting you" surface where the chip explains why the
// item is here, off for "Your open PRs" where every row has the same
// implicit reason.

const REASON_LABEL: Record<DashboardReason, string> = {
  review_requested: "Review",
  assigned: "Assigned",
  mentioned: "Mentioned",
};

const REASON_TONE: Record<DashboardReason, string> = {
  review_requested: "text-(--color-accent)",
  assigned: "text-foreground",
  mentioned: "text-(--color-fg-faint)",
};

const DOT_TONE: Record<Stale, string> = {
  fresh: "bg-(--color-fg-faint)",
  warm: "bg-(--color-warning)",
  overdue: "bg-(--color-warning)",
  ancient: "bg-(--color-danger)",
};

// Outer ring around the dot — same hue, lower opacity. Gives the dot a
// little glow on the dense list without adding chrome.
const DOT_GLOW: Record<Stale, string> = {
  fresh: "ring-(--color-fg-faint)/0",
  warm: "ring-(--color-warning)/30",
  overdue: "ring-(--color-warning)/40",
  ancient: "ring-(--color-danger)/40",
};

export type DashRowProps = {
  item: DashboardItem;
  /** Date field to drive both the latency dot and the trailing timestamp. */
  date: string;
  /** Show the reason chip ("REVIEW" / "ASSIGNED" / "MENTIONED"). */
  showReason: boolean;
};

export function DashRow({ item, date, showReason }: DashRowProps) {
  const owner = item.ownerRepo.owner;
  const repo = item.ownerRepo.repo;
  const stale = staleness(date);

  const linkProps = item.isPr
    ? ({
        to: "/$owner/$repo/pulls/$number",
        params: { owner, repo, number: item.number },
      } as const)
    : ({
        to: "/$owner/$repo/issues",
        params: { owner, repo },
        search: { issue: item.number },
      } as const);

  return (
    <Link
      {...linkProps}
      className={cn(
        "group flex items-center gap-3 rounded-md px-3 py-2 outline-none",
        // Row sits on the raised main panel (bg-muted). Hover/focus steps up
        // via the popover-active token, which mixes ~3% darker in light and
        // ~4% lighter in dark — same pattern as our dropdown / command
        // menu items so the visual language stays uniform.
        "transition-colors hover:bg-[var(--color-popover-active)] focus-visible:bg-[var(--color-popover-active)]",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 shrink-0 rounded-full ring-2 transition-colors",
          DOT_TONE[stale],
          DOT_GLOW[stale],
        )}
      />
      <span className="shrink-0">
        <ItemStateIcon item={item} />
      </span>
      <span className="hidden shrink-0 font-mono text-caption text-muted-foreground sm:inline">
        {owner}/{repo}
      </span>
      <span className="min-w-0 flex-1 truncate text-body font-[475] text-foreground">
        {item.title}
      </span>
      {item.comments > 0 && (
        <span
          className="hidden shrink-0 font-mono text-caption tabular-nums text-muted-foreground sm:inline"
          title={`${item.comments} comments`}
        >
          {item.comments}c
        </span>
      )}
      {showReason ? <ReasonChip reason={item.reason} /> : null}
      <span className="shrink-0 font-mono text-caption tabular-nums text-muted-foreground">
        {formatRelativeTime(date)}
      </span>
    </Link>
  );
}

function ItemStateIcon({ item }: { item: DashboardItem }) {
  if (item.isPr) {
    const state = toUiState({
      state: item.state,
      draft: item.draft ?? false,
      merged: !!item.pull_request?.merged_at,
    });
    return <PrStateIcon state={state} size={4} />;
  }
  return <CircleDot className="size-4 text-(--color-success)" />;
}

function ReasonChip({ reason }: { reason: DashboardReason }) {
  return (
    <span
      className={cn(
        "shrink-0 font-mono text-micro font-medium uppercase tracking-widest",
        REASON_TONE[reason],
      )}
    >
      {REASON_LABEL[reason]}
    </span>
  );
}
