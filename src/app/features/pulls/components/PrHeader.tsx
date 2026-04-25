import { Link } from "@tanstack/react-router";
import { ArrowLeft, GitBranch } from "lucide-react";
import { PrStatePill } from "@/app/features/pulls/components/PrStatePill";
import { toUiState } from "@/app/features/pulls/lib/prStatus";
import type { PullRequest } from "@/app/features/pulls/schemas";
import { cn } from "@/app/lib/cn";
import { formatRelativeTime } from "@/app/lib/time";

export type PrHeaderProps = {
  owner: string;
  repo: string;
  pr: PullRequest;
  rightSlot?: React.ReactNode;
};

export function PrHeader({ owner, repo, pr, rightSlot }: PrHeaderProps) {
  const state = toUiState(pr);
  const verb = state === "merged" ? "merged" : state === "closed" ? "closed" : "opened";
  const actionAt =
    state === "merged"
      ? pr.merged_at ?? pr.closed_at ?? pr.updated_at
      : state === "closed"
        ? pr.closed_at ?? pr.updated_at
        : pr.created_at;

  return (
    <div>
      {/* Line 1: Back + Actions */}
      <div className="mb-2 flex items-center justify-between">
        <Link
          to="/$owner/$repo/pulls"
          params={{ owner, repo }}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-sm px-1.5 py-1",
            "text-caption text-muted-foreground outline-none transition-colors",
            "hover:text-foreground focus-visible:ring-1 focus-visible:ring-foreground/15",
          )}
        >
          <ArrowLeft className="size-3" strokeWidth={2.25} />
          <span>Back</span>
        </Link>
        {rightSlot && <div className="flex-shrink-0">{rightSlot}</div>}
      </div>

      {/* Line 2: Title + State */}
      <h1 className="text-heading font-[550] leading-snug text-foreground">
        {pr.title}
        <span className="ml-2 font-mono text-title font-normal text-muted-foreground">
          #{pr.number}
        </span>
        <PrStatePill state={state} className="ml-2 align-middle" />
      </h1>

      {/* Line 3: Meta */}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-muted-foreground">
        <span className="font-medium text-foreground">{pr.user?.login ?? "ghost"}</span>
        <span className="text-[var(--color-fg-faint)]">·</span>
        <span>{verb} {formatRelativeTime(actionAt)}</span>
        <span className="text-[var(--color-fg-faint)]">·</span>
        <span className="inline-flex items-center gap-1 font-mono">
          <GitBranch className="size-3 text-[var(--color-fg-faint)]" />
          <span>{pr.base.ref}</span>
          <span className="text-[var(--color-fg-faint)]">←</span>
          <span>{pr.head.ref}</span>
        </span>
        <span className="text-[var(--color-fg-faint)]">·</span>
        <span className="tabular-nums">{pr.commits} commits</span>
        <span className="text-[var(--color-fg-faint)]">·</span>
        <span className="tabular-nums">{pr.changed_files} files</span>
        <span className="text-[var(--color-fg-faint)]">·</span>
        <span className="tabular-nums">
          <span className="text-[var(--color-success)]">+{pr.additions}</span>
          <span className="text-[var(--color-fg-faint)]"> </span>
          <span className="text-[var(--color-danger)]">−{pr.deletions}</span>
        </span>
      </div>
    </div>
  );
}
