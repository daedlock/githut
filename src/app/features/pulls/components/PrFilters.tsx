import { ChevronDown, GitPullRequest, GitPullRequestClosed } from "lucide-react";
import type { PullsSort, PullsState } from "@/app/features/pulls/hooks";
import { cn } from "@/app/lib/cn";

// ─── State tabs + sort (GitHub-parity filter bar) ─────────────────────────
//
// GitHub's list page header has two rows:
//   Row 1: [Open N] [Closed N]  + "New pull request" action (we skip, PRs
//          are authored on the source side of this app)
//   Row 2: Author ▾  Label ▾  Projects ▾  Milestones ▾  Reviews ▾  Assignee ▾  Sort ▾
//
// We render Row 1 here (state tabs) and a minimal Row 2 (sort only). The
// other chip-style filters (author, label, reviewer, assignee) will land
// in P9 once we have proper pickers. Filter values already plumb through
// the URL so power users can set them via ?author=X etc. before then.

export type PrFiltersProps = {
  state: PullsState;
  onStateChange: (next: PullsState) => void;
  sort: PullsSort;
  onSortChange: (next: PullsSort) => void;
  /** Total counts per state — drives the "Open 5 · Closed 12" counters. */
  counts: { open?: number; closed?: number };
};

const SORT_OPTIONS: { value: PullsSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "updated", label: "Recently updated" },
  { value: "comments", label: "Most commented" },
];

export function PrFilters({
  state,
  onStateChange,
  sort,
  onSortChange,
  counts,
}: PrFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <StateTab
        label="Open"
        icon={<GitPullRequest className="size-3.5" />}
        count={counts.open}
        isActive={state === "open"}
        onClick={() => onStateChange("open")}
        activeTone="text-(--color-success)"
      />
      <StateTab
        label="Closed"
        icon={<GitPullRequestClosed className="size-3.5" />}
        count={counts.closed}
        isActive={state === "closed"}
        onClick={() => onStateChange("closed")}
        activeTone="text-(--color-fg-muted)"
      />

      <span aria-hidden className="mx-1 h-4 w-px bg-border self-center" />

      {/* Minimal Row-2 sort. Full filter chip bar lands in P9. */}
      <label className="inline-flex items-center gap-1.5 text-caption text-muted-foreground">
        <span>Sort</span>
        <div className="relative">
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value as PullsSort)}
            className={cn(
              "h-6 appearance-none rounded-sm border border-border bg-(--color-bg-subtle)",
              "pl-2 pr-6 font-sans text-caption text-foreground outline-none",
              "focus-visible:ring-1 focus-visible:ring-(--color-focus)",
            )}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-1.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
        </div>
      </label>
    </div>
  );
}

function StateTab({
  label,
  icon,
  count,
  isActive,
  onClick,
  activeTone,
}: {
  label: string;
  icon: React.ReactNode;
  count: number | undefined;
  isActive: boolean;
  onClick: () => void;
  activeTone: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-sm px-2 outline-none",
        "font-sans text-caption",
        "focus-visible:ring-1 focus-visible:ring-(--color-focus)",
        isActive
          ? cn("bg-(--color-bg-sunken) font-medium text-foreground", activeTone)
          : "text-muted-foreground hover:bg-(--color-bg-sunken) hover:text-foreground",
      )}
      aria-current={isActive ? "page" : undefined}
    >
      {icon}
      <span>{label}</span>
      {typeof count === "number" ? (
        <span className="font-mono tabular-nums text-(--color-fg-faint)">{count}</span>
      ) : null}
    </button>
  );
}
