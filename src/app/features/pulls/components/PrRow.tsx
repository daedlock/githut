import { Link } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { Avatar } from "@/app/components/ui/avatar";
import { ProfileLink } from "@/app/components/user/ProfileLink";
import { LabelPill } from "@/app/features/issues/components/LabelPill";
import { PrStateIcon } from "@/app/features/pulls/components/PrStatePill";
import { toUiState } from "@/app/features/pulls/lib/prStatus";
import type { PrListItem } from "@/app/features/pulls/hooks";
import { formatRelativeTime } from "@/app/lib/time";

// ─── PrRow ─────────────────────────────────────────────────────────────────
//
// Mirrors `IssueRow` exactly — same padding (`px-4 py-3.5 sm:px-5`), same
// text tokens (`text-body` title, `text-caption text-(--color-fg-faint)`
// meta, `·` separators), same assignee-stack on the right. Only swaps are
// PR-specific: the leading state icon (git-pull-request family) and the
// meta verb ("opened/merged/closed by").
//
// Interaction model also matches IssueRow: the whole row is a Link so
// TanStack Router's intent-preload warms the detail route on hover.

export type PrRowProps = {
  owner: string;
  repo: string;
  pr: PrListItem;
};

export function PrRow({ owner, repo, pr }: PrRowProps) {
  const state = toUiState({
    state: pr.state,
    draft: pr.draft ?? false,
    merged: !!pr.pull_request?.merged_at,
  });
  const isClosedLike = state === "closed" || state === "merged";
  const timeAt = isClosedLike ? pr.closed_at ?? pr.updated_at : pr.created_at;
  const timeVerb = state === "merged" ? "merged" : state === "closed" ? "closed" : "opened";

  return (
    <Link
      to="/$owner/$repo/pulls/$number"
      params={{ owner, repo, number: pr.number }}
      className="group block rounded-lg outline-none transition-colors focus-visible:bg-muted hover:bg-muted"
    >
      <div className="flex w-full items-start gap-3 px-4 py-2.5 text-left">
        <div className="mt-0.5 flex-shrink-0">
          <PrStateIcon state={state} size={4} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-body font-[475] text-foreground">{pr.title}</span>
            {pr.labels.map((l) => (
              <LabelPill
                key={l.id}
                label={{
                  id: l.id,
                  name: l.name,
                  color: l.color,
                  description: l.description ?? null,
                }}
                size="xs"
              />
            ))}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-ui text-muted-foreground">
            <span>
              <span className="font-mono">#{pr.number}</span>
              {" · "}
              {timeVerb} {formatRelativeTime(timeAt)}
              {pr.user ? (
                <>
                  {" by "}
                  <ProfileLink
                    login={pr.user.login}
                    stopPropagation
                    className="text-muted-foreground"
                  >
                    {pr.user.login}
                  </ProfileLink>
                </>
              ) : null}
            </span>
            {pr.comments > 0 && (
              <span className="inline-flex items-center gap-1">
                <MessageSquare className="size-3" />
                {pr.comments}
              </span>
            )}
{pr.assignees.length > 0 && (
          <div className="mt-0.5 flex ">
            {pr.assignees.slice(0, 3).map((a) => (
              <Avatar key={a.login} login={a.login} avatarUrl={a.avatar_url} size="sm" />
            ))}
          </div>
        )}

          </div>
        </div>
              </div>
    </Link>
  );
}
