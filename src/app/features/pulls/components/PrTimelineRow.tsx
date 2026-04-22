import {
  Bookmark,
  Circle,
  CircleDot,
  GitCommit,
  GitMerge,
  GitPullRequestClosed,
  Lock,
  type LucideIcon,
  Milestone,
  Pin,
  Tag,
  Unlock,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { ProfileLink } from "@/app/components/user/ProfileLink";
import type { TimelineEvent } from "@/app/features/pulls/schemas";
import { cn } from "@/app/lib/cn";
import { formatRelativeTime } from "@/app/lib/time";

// ─── PrTimelineRow ─────────────────────────────────────────────────────────
//
// Inline, single-line event strip shown between comment cards. Mirrors
// GitHub's own "X did Y — N hours ago" rows (labeled, assigned, closed,
// merged, head-ref-force-pushed, …). Unknown events render with a neutral
// bookmark icon so the timeline never fails closed.

type IconTone = "muted" | "success" | "danger" | "merged" | "warning";

const TONE: Record<IconTone, string> = {
  muted: "text-[var(--color-fg-faint)]",
  success: "text-[var(--color-success)]",
  danger: "text-[var(--color-danger)]",
  merged: "text-[var(--color-pr-merged)]",
  warning: "text-[var(--color-warning)]",
};

function resolve(event: TimelineEvent): {
  icon: LucideIcon;
  tone: IconTone;
  label: React.ReactNode;
} | null {
  const actor = event.actor ? (
    <ProfileLink login={event.actor.login} className="font-medium text-foreground">
      {event.actor.login}
    </ProfileLink>
  ) : (
    <span className="font-medium text-foreground">ghost</span>
  );

  switch (event.event) {
    case "labeled":
      return {
        icon: Tag,
        tone: "muted",
        label: (
          <>
            {actor} added the{" "}
            <span
              className="inline-flex items-center rounded-full border border-border px-1.5 py-0 text-micro text-foreground"
              style={
                event.label
                  ? { backgroundColor: `#${event.label.color}14` }
                  : undefined
              }
            >
              {event.label?.name ?? "label"}
            </span>{" "}
            label
          </>
        ),
      };
    case "unlabeled":
      return {
        icon: Tag,
        tone: "muted",
        label: (
          <>
            {actor} removed the {event.label?.name ?? "label"} label
          </>
        ),
      };
    case "assigned":
      return {
        icon: UserPlus,
        tone: "muted",
        label: (
          <>
            {actor} assigned{" "}
            {event.assignee ? (
              <ProfileLink
                login={event.assignee.login}
                className="font-medium text-foreground"
              >
                {event.assignee.login}
              </ProfileLink>
            ) : (
              "someone"
            )}
          </>
        ),
      };
    case "unassigned":
      return {
        icon: UserMinus,
        tone: "muted",
        label: (
          <>
            {actor} unassigned{" "}
            {event.assignee ? event.assignee.login : "someone"}
          </>
        ),
      };
    case "review_requested":
      return {
        icon: UserPlus,
        tone: "muted",
        label: (
          <>
            {actor} requested a review from{" "}
            {event.requested_reviewer ? (
              <ProfileLink
                login={event.requested_reviewer.login}
                className="font-medium text-foreground"
              >
                {event.requested_reviewer.login}
              </ProfileLink>
            ) : (
              "a reviewer"
            )}
          </>
        ),
      };
    case "review_request_removed":
      return {
        icon: UserMinus,
        tone: "muted",
        label: (
          <>
            {actor} dismissed a review request
          </>
        ),
      };
    case "closed":
      return {
        icon: Circle,
        tone: "danger",
        label: <>{actor} closed this</>,
      };
    case "reopened":
      return {
        icon: CircleDot,
        tone: "success",
        label: <>{actor} reopened this</>,
      };
    case "merged":
      return {
        icon: GitMerge,
        tone: "merged",
        label: (
          <>
            {actor} merged commit{" "}
            {event.commit_id && (
              <span className="font-mono text-caption text-muted-foreground">
                {event.commit_id.slice(0, 7)}
              </span>
            )}
          </>
        ),
      };
    case "ready_for_review":
      return {
        icon: GitPullRequestClosed,
        tone: "success",
        label: <>{actor} marked this pull request as ready for review</>,
      };
    case "convert_to_draft":
      return {
        icon: GitPullRequestClosed,
        tone: "muted",
        label: <>{actor} marked this pull request as a draft</>,
      };
    case "head_ref_force_pushed":
      return {
        icon: GitCommit,
        tone: "warning",
        label: <>{actor} force-pushed the branch</>,
      };
    case "head_ref_deleted":
      return {
        icon: GitCommit,
        tone: "muted",
        label: <>{actor} deleted the head branch</>,
      };
    case "head_ref_restored":
      return {
        icon: GitCommit,
        tone: "muted",
        label: <>{actor} restored the head branch</>,
      };
    case "locked":
      return {
        icon: Lock,
        tone: "muted",
        label: <>{actor} locked the conversation</>,
      };
    case "unlocked":
      return {
        icon: Unlock,
        tone: "muted",
        label: <>{actor} unlocked the conversation</>,
      };
    case "pinned":
      return { icon: Pin, tone: "muted", label: <>{actor} pinned this</> };
    case "unpinned":
      return { icon: Pin, tone: "muted", label: <>{actor} unpinned this</> };
    case "milestoned":
      return {
        icon: Milestone,
        tone: "muted",
        label: (
          <>
            {actor} added this to the{" "}
            {event.milestone ? (
              <span className="font-medium text-foreground">
                {event.milestone.title}
              </span>
            ) : (
              "milestone"
            )}
          </>
        ),
      };
    case "demilestoned":
      return {
        icon: Milestone,
        tone: "muted",
        label: <>{actor} removed this from a milestone</>,
      };
    case "renamed":
      return {
        icon: Bookmark,
        tone: "muted",
        label: (
          <>
            {actor} changed the title{" "}
            {event.rename && (
              <>
                from <span className="text-muted-foreground">{event.rename.from}</span>{" "}
                to <span className="font-medium text-foreground">{event.rename.to}</span>
              </>
            )}
          </>
        ),
      };
    case "mentioned":
    case "subscribed":
    case "unsubscribed":
      // Too noisy to render — GitHub hides these from the default view too.
      return null;
    default:
      return {
        icon: Bookmark,
        tone: "muted",
        label: (
          <>
            {actor} {event.event.replace(/_/g, " ")}
          </>
        ),
      };
  }
}

export function PrTimelineRow({ event }: { event: TimelineEvent }) {
  const resolved = resolve(event);
  if (!resolved) return null;
  const Icon = resolved.icon;
  const at = event.created_at ?? event.submitted_at;

  return (
    <div className="flex items-center gap-2 pl-2 text-caption text-muted-foreground">
      <Icon className={cn("size-3.5 shrink-0", TONE[resolved.tone])} aria-hidden />
      <span className="min-w-0 truncate">
        {resolved.label}
        {at && (
          <>
            {" "}
            <span className="text-[var(--color-fg-faint)]">
              · {formatRelativeTime(at)}
            </span>
          </>
        )}
      </span>
    </div>
  );
}
