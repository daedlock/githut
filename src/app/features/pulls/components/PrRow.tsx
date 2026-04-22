import { Link } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { Avatar } from "@/app/components/ui/avatar";
import { ProfileLink } from "@/app/components/user/ProfileLink";
import { LabelPill } from "@/app/features/issues/components/LabelPill";
import { PrStateIcon } from "@/app/features/pulls/components/PrStatePill";
import { toUiState } from "@/app/features/pulls/lib/prStatus";
import type { PrListItem } from "@/app/features/pulls/hooks";
import { cn } from "@/app/lib/cn";
import { formatRelativeTime } from "@/app/lib/time";

export type PrRowProps = {
  owner: string;
  repo: string;
  pr: PrListItem;
};

/**
 * One PR in the list. Layout mirrors github.com's row exactly:
 *   [state icon]  Title                         #number · updated · comments
 *                 opened by user · [labels]               [assignees stack]
 *
 * The whole row is a `<Link>` so router intent-preload warms the detail
 * route on hover. Assignee avatars are interactive (click to filter) —
 * nested <Link>s inside a <Link> aren't valid HTML, so we use a single
 * nav link and let individual assignee-filter actions fire via programmatic
 * navigate() in a later phase (for now they're just display).
 */
export function PrRow({ owner, repo, pr }: PrRowProps) {
  const state = toUiState({
    state: pr.state,
    draft: pr.draft ?? false,
    merged: !!pr.pull_request?.merged_at,
  });
  const openedAt = pr.created_at;
  const closedAt = pr.closed_at ?? null;
  const isClosedLike = state === "closed" || state === "merged";
  const timeAt = isClosedLike && closedAt ? closedAt : pr.updated_at;
  const timeVerb = isClosedLike ? (state === "merged" ? "merged" : "closed") : "opened";

  return (
    <Link
      to="/$owner/$repo/pulls/$number"
      params={{ owner, repo, number: pr.number }}
      className={cn(
        "group flex items-start gap-3 border-b border-border px-4 py-3 last:border-b-0",
        "outline-none hover:bg-(--color-bg-sunken) focus-visible:bg-(--color-bg-sunken)",
      )}
    >
      <PrStateIcon state={state} size={4} className="mt-0.5 shrink-0" />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="truncate text-body font-medium text-foreground">{pr.title}</span>
          {pr.labels.map((l) => (
            <LabelPill
              key={l.id}
              label={{ id: l.id, name: l.name, color: l.color, description: l.description ?? null }}
              size="xs"
            />
          ))}
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-caption text-muted-foreground">
          <span className="font-mono">#{pr.number}</span>
          <Sep />
          <span>{timeVerb}</span>
          <span>{formatRelativeTime(isClosedLike ? timeAt : openedAt)}</span>
          {pr.user ? (
            <>
              <span>by</span>
              <ProfileLink login={pr.user.login} stopPropagation className="font-mono">
                {pr.user.login}
              </ProfileLink>
            </>
          ) : null}
          {pr.comments > 0 ? (
            <>
              <Sep />
              <span className="inline-flex items-center gap-1">
                <MessageSquare className="size-3" />
                {pr.comments}
              </span>
            </>
          ) : null}
        </div>
      </div>

      {pr.assignees.length > 0 ? (
        <div className="mt-0.5 flex -space-x-1.5">
          {pr.assignees.slice(0, 3).map((a) => (
            <Avatar key={a.login} login={a.login} avatarUrl={a.avatar_url} size="sm" />
          ))}
        </div>
      ) : null}
    </Link>
  );
}

function Sep() {
  return (
    <span className="text-(--color-fg-faint)" aria-hidden>
      ·
    </span>
  );
}
