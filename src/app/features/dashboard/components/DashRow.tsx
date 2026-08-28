import { Link } from "@tanstack/react-router";
import { CircleDot } from "lucide-react";
import { Avatar } from "@/app/components/ui/avatar";
import type { DashboardItem, DashboardReason } from "@/app/features/dashboard/hooks";
import { PrStateIcon } from "@/app/features/pulls/components/PrStatePill";
import { toUiState } from "@/app/features/pulls/lib/prStatus";
import { cn } from "@/app/lib/cn";
import { formatRelativeTime } from "@/app/lib/time";

// ─── DashRow ──────────────────────────────────────────────────────────────
//
// Dashboard rows mirror PR/issue list rows: state icon, title first, then a
// quiet metadata line. The dashboard-specific reason stays in metadata so it
// explains why the row is present without becoming the row's primary content.

const REASON_LABEL: Record<DashboardReason, string> = {
  review_requested: "Review",
  assigned: "Assigned",
  mentioned: "Mentioned",
};

const REASON_DOT: Record<DashboardReason, string> = {
  review_requested: "bg-(--color-brand)",
  assigned: "bg-(--color-warning)",
  mentioned: "bg-(--color-fg-faint)",
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

  const linkProps = item.isPr
    ? ({
        to: "/$owner/$repo/pull/$number",
        params: { owner, repo, number: item.number },
      } as const)
    : ({
        to: "/$owner/$repo/issues/$number",
        params: { owner, repo, number: item.number },
      } as const);

  return (
    <Link
      {...linkProps}
      data-keyboard-list-item
      className="group block rounded-lg outline-none transition-colors hover:bg-muted focus-visible:bg-muted"
    >
      <div className="flex w-full items-start gap-3 px-4 py-2.5 text-left">
        <div className="mt-0.5 flex-shrink-0">
          <ItemStateIcon item={item} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-body font-[475] text-foreground">{item.title}</span>
            {showReason ? <ReasonPill reason={item.reason} /> : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-caption text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="font-mono">#{item.number}</span>
              <span className="text-(--color-fg-faint)">·</span>
              <Avatar login={owner} avatarUrl={githubAvatar(owner)} size="xs" />
              <span className="font-mono">
                {owner}/{repo}
              </span>
              <span className="text-(--color-fg-faint)">·</span>
              updated {formatRelativeTime(date)}
            </span>
            {item.user ? (
              <span className="inline-flex items-center gap-1.5">
                <Avatar login={item.user.login} avatarUrl={item.user.avatar_url} size="xs" />
                {item.user.login}
              </span>
            ) : null}
            {item.comments > 0 && (
              <span className="inline-flex items-center gap-1.5">
                {item.comments} {item.comments === 1 ? "comment" : "comments"}
              </span>
            )}
          </div>
        </div>
      </div>
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

function ReasonPill({ reason }: { reason: DashboardReason }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1.5 rounded-full bg-muted px-2 text-caption text-muted-foreground",
        "group-hover:bg-background group-focus-visible:bg-background",
      )}
    >
      <span className={cn("size-1.5 rounded-full", REASON_DOT[reason])} />
      {REASON_LABEL[reason]}
    </span>
  );
}

function githubAvatar(login: string): string {
  return `https://github.com/${login}.png`;
}
