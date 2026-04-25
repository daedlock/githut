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
  actionsSlot?: React.ReactNode;
};

export function PrHeader({ owner, repo, pr, actionsSlot }: PrHeaderProps) {
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
      <Link
        to="/$owner/$repo/pulls"
        params={{ owner, repo }}
        className={cn(
          "mb-3 inline-flex items-center gap-1.5 rounded-sm px-1.5 py-1 -ml-1.5",
          "text-xs text-muted-foreground outline-none transition-colors",
          "hover:text-foreground focus-visible:ring-1 focus-visible:ring-foreground/15",
        )}
      >
        <ArrowLeft className="size-3" strokeWidth={2.25} />
        <span>All pull requests</span>
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold leading-tight text-foreground">
            {pr.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
            <PrStatePill state={state} />
            <span className="opacity-50">·</span>
            <span className="font-mono">#{pr.number}</span>
            <span className="opacity-50">·</span>
            <span className="font-medium text-foreground">{pr.user?.login ?? "ghost"}</span>
            <span>{verb}</span>
            <span>{formatRelativeTime(actionAt)}</span>
            <span className="opacity-50">·</span>
            <span className="inline-flex items-center gap-1 font-mono">
              <GitBranch className="size-3 opacity-50" />
              <span>{pr.head.ref}</span>
              <span className="opacity-50">→</span>
              <span>{pr.base.ref}</span>
            </span>
          </div>
        </div>
        {actionsSlot && <div className="flex-shrink-0 pt-1">{actionsSlot}</div>}
      </div>
    </div>
  );
}
