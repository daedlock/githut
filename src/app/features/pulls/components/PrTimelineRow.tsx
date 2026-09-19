import {
  Bookmark,
  ChevronRight,
  Circle,
  CircleDot,
  EyeOff,
  GitBranch,
  GitCommit,
  GitMerge,
  GitPullRequestClosed,
  Link2,
  Lock,
  type LucideIcon,
  Milestone,
  Pin,
  Rocket,
  Tag,
  Unlock,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { useMemo, useState } from "react";
import { detectEntity, EntityHoverLink } from "@/app/components/ui/EntityHoverCard";
import { ProfileLink } from "@/app/components/user/ProfileLink";
import type {
  CommitGroupItem,
  TimelineEventFeedItem,
} from "@/app/features/pulls/lib/mergeTimeline";
import type { TimelineEvent } from "@/app/features/pulls/schemas";
import { cn } from "@/app/lib/cn";
import { formatRelativeTime } from "@/app/lib/time";

// ─── PrTimelineRow ─────────────────────────────────────────────────────────
//
// Inline, single-line event strip shown between comment cards. Mirrors
// GitHub's own "X did Y · N hours ago" rows (labeled, assigned, closed,
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

function shortSha(sha: string | null | undefined): string | null {
  return sha ? sha.slice(0, 7) : null;
}

function firstLine(value: string | null | undefined): string | null {
  const line = value?.trim().split("\n")[0]?.trim();
  return line || null;
}

function branchName(event: TimelineEvent, fallback = "branch"): string {
  return event.head_ref ?? event.base_ref ?? event.ref ?? fallback;
}

function Branch({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-caption text-muted-foreground">{children}</span>;
}

function Commit({ sha }: { sha: string | null | undefined }) {
  const s = shortSha(sha);
  if (!s) return null;
  return <span className="font-mono text-caption text-muted-foreground">{s}</span>;
}

function IssueRef({ event }: { event: TimelineEvent }) {
  const issue = event.source?.issue;
  if (!issue) return <span className="font-medium text-foreground">an issue</span>;
  const label = `#${issue.number}`;
  const entity = detectEntity(issue.html_url, label);
  const content = (
    <>
      {label}
      {issue.title ? (
        <span className="font-normal text-muted-foreground"> {issue.title}</span>
      ) : null}
    </>
  );
  const className = "font-medium text-foreground underline-offset-2 hover:underline";

  if (entity) {
    return (
      <EntityHoverLink entity={entity} href={issue.html_url} className={className}>
        {content}
      </EntityHoverLink>
    );
  }

  return (
    <a href={issue.html_url} target="_blank" rel="noopener noreferrer" className={className}>
      {content}
    </a>
  );
}

function projectDetail(event: TimelineEvent): React.ReactNode {
  const projectName = event.project?.name;
  const column = event.project_card?.column_name;
  if (projectName && column) {
    return (
      <>
        <span className="font-medium text-foreground">{projectName}</span>
        <span className="text-[var(--color-fg-faint)]"> · {column}</span>
      </>
    );
  }
  if (projectName) return <span className="font-medium text-foreground">{projectName}</span>;
  if (column) return <span className="font-medium text-foreground">{column}</span>;
  return "a project";
}

function ActorName({ event }: { event: TimelineEvent }) {
  return event.actor ? (
    <ProfileLink login={event.actor.login} className="font-medium text-foreground">
      {event.actor.login}
    </ProfileLink>
  ) : (
    <span className="font-medium text-foreground">ghost</span>
  );
}

function commitMessage(event: TimelineEvent): string | null {
  return firstLine(event.message) ?? firstLine(event.body);
}

function resolve(event: TimelineEvent): {
  icon: LucideIcon;
  tone: IconTone;
  label: React.ReactNode;
} | null {
  const actor = <ActorName event={event} />;

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
              style={event.label ? { backgroundColor: `#${event.label.color}14` } : undefined}
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
              <ProfileLink login={event.assignee.login} className="font-medium text-foreground">
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
            {actor} unassigned {event.assignee ? event.assignee.login : "someone"}
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
        label: <>{actor} dismissed a review request</>,
      };
    case "closed":
      return { icon: Circle, tone: "danger", label: <>{actor} closed this</> };
    case "reopened":
      return { icon: CircleDot, tone: "success", label: <>{actor} reopened this</> };
    case "merged":
      return {
        icon: GitMerge,
        tone: "merged",
        label: (
          <>
            {actor} merged commit <Commit sha={event.commit_id} />
          </>
        ),
      };
    case "committed": {
      const sha = event.sha ?? event.commit_id;
      const message = commitMessage(event);
      return {
        icon: GitCommit,
        tone: "muted",
        label: (
          <>
            {actor} committed <Commit sha={sha} />
            {message ? <span className="text-muted-foreground"> · {message}</span> : null}
          </>
        ),
      };
    }
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
        label: (
          <>
            {actor} force-pushed the <Branch>{branchName(event, "head")}</Branch> branch
            {event.before || event.after ? (
              <span className="text-[var(--color-fg-faint)]">
                {" "}
                from <Commit sha={event.before} /> to <Commit sha={event.after} />
              </span>
            ) : null}
          </>
        ),
      };
    case "head_ref_deleted":
      return {
        icon: GitBranch,
        tone: "muted",
        label: (
          <>
            {actor} deleted the <Branch>{branchName(event, "head")}</Branch> branch
          </>
        ),
      };
    case "head_ref_restored":
      return {
        icon: GitBranch,
        tone: "success",
        label: (
          <>
            {actor} restored the <Branch>{branchName(event, "head")}</Branch> branch
          </>
        ),
      };
    case "base_ref_changed":
      return {
        icon: GitBranch,
        tone: "warning",
        label: (
          <>
            {actor} changed the base branch
            {event.base_ref ? (
              <>
                {" "}
                to <Branch>{event.base_ref}</Branch>
              </>
            ) : null}
          </>
        ),
      };
    case "base_ref_force_pushed":
      return {
        icon: GitCommit,
        tone: "warning",
        label: (
          <>
            {actor} force-pushed the base branch
            {event.before || event.after ? (
              <span className="text-[var(--color-fg-faint)]">
                {" "}
                from <Commit sha={event.before} /> to <Commit sha={event.after} />
              </span>
            ) : null}
          </>
        ),
      };
    case "base_ref_deleted":
      return { icon: GitBranch, tone: "danger", label: <>{actor} deleted the base branch</> };
    case "base_ref_restored":
      return { icon: GitBranch, tone: "success", label: <>{actor} restored the base branch</> };
    case "cross-referenced":
    case "referenced":
      return {
        icon: Link2,
        tone: "muted",
        label: (
          <>
            {actor} referenced this in <IssueRef event={event} />
          </>
        ),
      };
    case "connected":
      return {
        icon: Link2,
        tone: "success",
        label: (
          <>
            {actor} linked <IssueRef event={event} />
          </>
        ),
      };
    case "disconnected":
      return {
        icon: Link2,
        tone: "muted",
        label: (
          <>
            {actor} unlinked <IssueRef event={event} />
          </>
        ),
      };
    case "review_dismissed":
      return {
        icon: EyeOff,
        tone: "warning",
        label: (
          <>
            {actor} dismissed a review
            {event.dismissed_review?.dismissal_message ? (
              <span className="text-muted-foreground">
                {" "}
                with reason: {event.dismissed_review.dismissal_message}
              </span>
            ) : null}
          </>
        ),
      };
    case "auto_merge_enabled":
      return { icon: GitMerge, tone: "success", label: <>{actor} enabled auto-merge</> };
    case "auto_merge_disabled":
      return { icon: GitMerge, tone: "muted", label: <>{actor} disabled auto-merge</> };
    case "deployed":
      return {
        icon: Rocket,
        tone: "success",
        label: (
          <>
            {actor} deployed
            {event.deployment?.environment || event.environment ? (
              <>
                {" "}
                to{" "}
                <span className="font-medium text-foreground">
                  {event.deployment?.environment ?? event.environment}
                </span>
              </>
            ) : null}
          </>
        ),
      };
    case "deployment_environment_changed":
      return {
        icon: Rocket,
        tone: "warning",
        label: (
          <>
            {actor} changed the deployment environment
            {event.environment ? (
              <>
                {" "}
                to <span className="font-medium text-foreground">{event.environment}</span>
              </>
            ) : null}
          </>
        ),
      };
    case "added_to_project":
      return {
        icon: Bookmark,
        tone: "muted",
        label: (
          <>
            {actor} added this to {projectDetail(event)}
          </>
        ),
      };
    case "moved_columns_in_project":
      return {
        icon: Bookmark,
        tone: "muted",
        label: (
          <>
            {actor} moved this in {projectDetail(event)}
          </>
        ),
      };
    case "removed_from_project":
      return {
        icon: Bookmark,
        tone: "muted",
        label: (
          <>
            {actor} removed this from {projectDetail(event)}
          </>
        ),
      };
    case "locked":
      return { icon: Lock, tone: "muted", label: <>{actor} locked the conversation</> };
    case "unlocked":
      return { icon: Unlock, tone: "muted", label: <>{actor} unlocked the conversation</> };
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
              <span className="font-medium text-foreground">{event.milestone.title}</span>
            ) : (
              "milestone"
            )}
          </>
        ),
      };
    case "demilestoned":
      return { icon: Milestone, tone: "muted", label: <>{actor} removed this from a milestone</> };
    case "renamed":
      return {
        icon: Bookmark,
        tone: "muted",
        label: (
          <>
            {actor} changed the title{" "}
            {event.rename && (
              <>
                from <span className="text-muted-foreground">{event.rename.from}</span> to{" "}
                <span className="font-medium text-foreground">{event.rename.to}</span>
              </>
            )}
          </>
        ),
      };
    case "mentioned":
    case "subscribed":
    case "unsubscribed":
      // Too noisy to render. GitHub hides these from the default view too.
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

function commitActors(commits: TimelineEventFeedItem[]): string {
  const actors = [...new Set(commits.map((commit) => commit.actor?.login ?? "ghost"))];
  if (actors.length === 1) return actors[0]!;
  if (actors.length === 2) return `${actors[0]} and ${actors[1]}`;
  return `${actors[0]} and ${actors.length - 1} others`;
}

function CommitRow({ event }: { event: TimelineEventFeedItem }) {
  const message = commitMessage(event);
  return (
    <div className="flex min-w-0 items-baseline gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-muted">
      <span className="shrink-0 text-caption text-muted-foreground">
        <ActorName event={event} /> committed
      </span>
      <Commit sha={event.sha ?? event.commit_id} />
      {message ? (
        <span className="min-w-0 truncate text-caption text-muted-foreground">{message}</span>
      ) : null}
      <span className="ml-auto shrink-0 text-micro text-[var(--color-fg-faint)]">
        {formatRelativeTime(event.at)}
      </span>
    </div>
  );
}

export function PrCommitGroupRow({ item }: { item: CommitGroupItem }) {
  const [expanded, setExpanded] = useState(false);
  const commits = item.commits;
  const visible = expanded ? commits : commits.slice(0, 3);
  const hiddenCount = Math.max(0, commits.length - visible.length);
  const summary = useMemo(() => commitActors(commits), [commits]);

  return (
    <div className="relative">
      <div className="absolute left-3 top-4 z-10 flex size-6 -translate-x-1/2 items-center justify-center rounded-full bg-muted ring-2 ring-background">
        <GitCommit className={cn("size-3", TONE.muted)} aria-hidden />
      </div>
      <div className="min-w-0 flex-1 pt-4 pl-10">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-caption outline-none transition-colors",
            "text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-1 focus-visible:ring-foreground/15",
          )}
          aria-expanded={expanded}
        >
          <ChevronRight
            className={cn("size-3.5 shrink-0 transition-transform", expanded && "rotate-90")}
          />
          <span className="min-w-0 flex-1 truncate">
            <span className="font-medium text-foreground">{summary}</span> committed{" "}
            <span className="tabular-nums text-foreground">{commits.length}</span>{" "}
            {commits.length === 1 ? "commit" : "commits"}
          </span>
          <span className="shrink-0 text-micro text-[var(--color-fg-faint)]">
            {formatRelativeTime(commits[0]?.at ?? item.at)}
          </span>
        </button>

        <div className="mt-1 flex flex-col gap-0.5">
          {visible.map((commit) => (
            <CommitRow key={commit.sha ?? commit.commit_id ?? commit.at} event={commit} />
          ))}
        </div>

        {!expanded && hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="mt-1 rounded-md px-2 py-1 text-caption text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Show {hiddenCount} more {hiddenCount === 1 ? "commit" : "commits"}
          </button>
        )}
      </div>
    </div>
  );
}

export function PrTimelineRow({ event }: { event: TimelineEvent }) {
  const resolved = resolve(event);
  if (!resolved) return null;
  const Icon = resolved.icon;
  const at = event.created_at ?? event.submitted_at;

  return (
    <>
      {/* Marker centered on the vertical bar */}
      <div className="absolute left-3 top-4 z-10 flex size-6 -translate-x-1/2 items-center justify-center rounded-full bg-muted ring-2 ring-background">
        <Icon className={cn("size-3", TONE[resolved.tone])} aria-hidden />
      </div>
      {/* Content */}
      <div className="min-w-0 flex-1 pt-4 pl-10">
        <div className="py-1.5 text-caption text-muted-foreground">
          <span className="block min-w-0 [overflow-wrap:anywhere]">
            {resolved.label}
            {at && (
              <>
                {" "}
                <span className="text-[var(--color-fg-faint)]">· {formatRelativeTime(at)}</span>
              </>
            )}
          </span>
        </div>
      </div>
    </>
  );
}
