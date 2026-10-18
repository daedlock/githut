import { Buildings, MapPin } from "@phosphor-icons/react";
import {
  CommentIcon,
  GitPullRequestIcon,
  IssueClosedIcon,
  IssueOpenedIcon,
  PeopleIcon,
  RepoIcon,
} from "@primer/octicons-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Avatar } from "@/app/components/ui/avatar";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/app/components/ui/hover-card";
import { Skeleton } from "@/app/components/ui/skeleton";
import { LabelPill } from "@/app/features/issues/components/LabelPill";
import { issueKeys } from "@/app/features/issues/hooks";
import type { RepoIssue } from "@/app/features/issues/schemas";
import { IssueDetailSchema } from "@/app/features/issues/schemas";
import { profileQueryOptions } from "@/app/features/profile/hooks";
import { cn } from "@/app/lib/cn";
import { getGitHubClient } from "@/app/lib/github/client";
import { formatRelativeTime } from "@/app/lib/time";
import { useAuthStore } from "@/app/stores/auth";

// ─── Detection ────────────────────────────────────────────────────────────

export type EntityRef =
  | { kind: "mention"; login: string }
  | { kind: "issue"; owner: string; repo: string; number: number }
  | { kind: "pull"; owner: string; repo: string; number: number };

export function detectEntity(href: string, text: string): EntityRef | null {
  // @username — text starts with @, href points to github.com/<user>
  if (typeof text === "string" && text.startsWith("@")) {
    const login = text.slice(1);
    if (login && /^[a-zA-Z0-9_-]+$/.test(login)) {
      return { kind: "mention", login };
    }
  }

  // #123 — text starts with #, href points to a GitHub issue or pull request.
  if (typeof text === "string" && /^#\d+$/.test(text)) {
    try {
      const url = new URL(href);
      if (url.hostname !== "github.com") return null;
      const m = url.pathname.match(/^\/([^/]+)\/([^/]+)\/(issues|pull)\/(\d+)/);
      if (m) {
        return {
          kind: m[3] === "pull" ? "pull" : "issue",
          owner: m[1]!,
          repo: m[2]!,
          number: Number(m[4]),
        };
      }
    } catch {
      /* not a URL */
    }
  }

  return null;
}

// ─── Wrapper ──────────────────────────────────────────────────────────────

export function EntityHoverLink({
  entity,
  href,
  children,
  ...rest
}: {
  entity: EntityRef;
  href: string;
  children: React.ReactNode;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const trigger =
    entity.kind === "mention" ? (
      <Link to="/$username" params={{ username: entity.login }} {...rest}>
        {children}
      </Link>
    ) : entity.kind === "pull" ? (
      <Link
        to="/$owner/$repo/pull/$number"
        params={{ owner: entity.owner, repo: entity.repo, number: entity.number }}
        {...rest}
      >
        {children}
      </Link>
    ) : (
      <Link
        to="/$owner/$repo/issues/$number"
        params={{ owner: entity.owner, repo: entity.repo, number: entity.number }}
        {...rest}
      >
        {children}
      </Link>
    );

  return (
    <HoverCard openDelay={300} closeDelay={100}>
      <HoverCardTrigger asChild>{trigger}</HoverCardTrigger>
      <HoverCardContent side="top" align="start" sideOffset={6} className="w-72 p-0">
        {entity.kind === "mention" ? (
          <UserCard login={entity.login} />
        ) : (
          <IssueCard owner={entity.owner} repo={entity.repo} number={entity.number} />
        )}
      </HoverCardContent>
    </HoverCard>
  );
}

// ─── Shared anatomy ───────────────────────────────────────────────────────
// One preview card for every content ref: an identity line (icon, mono id,
// age), a title, a short description, then meta. Loading uses Skeleton.

function CardSkeleton({ avatar = false }: { avatar?: boolean }) {
  return (
    <div role="status" className="flex flex-col gap-2 p-3">
      <span className="sr-only">Loading preview</span>
      <div className="flex items-center gap-2">
        <Skeleton className={cn("shrink-0", avatar ? "size-9 rounded-full" : "size-4")} />
        <Skeleton className="h-2.5 w-36" />
      </div>
      <Skeleton className="h-3 w-4/5" />
      <Skeleton className="h-2.5 w-3/5" />
    </div>
  );
}

function CardError({ children }: { children: React.ReactNode }) {
  return <p className="p-3 text-caption text-muted-foreground">{children}</p>;
}

/** First readable line of a markdown body, for the card's description. */
function snippet(body: string): string {
  for (const raw of body.split("\n")) {
    const line = raw
      .replace(/<!--.*?-->|<[^>]+>/g, "")
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/^[#>*\-\s]+|[*_`~]/g, "")
      .trim();
    if (line) return line;
  }
  return "";
}

// ─── User card ────────────────────────────────────────────────────────────

function UserCard({ login }: { login: string }) {
  const token = useAuthStore((s) => s.token);
  const { data: profile, isPending } = useQuery({
    ...profileQueryOptions(login),
    enabled: !!token && !!login,
  });

  if (isPending) return <CardSkeleton avatar />;
  if (!profile) return <CardError>Couldn't load @{login}.</CardError>;

  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex items-center gap-2.5">
        <Avatar login={profile.login} avatarUrl={profile.avatar_url} size="lg" />
        <div className="flex min-w-0 flex-col">
          <Link
            to="/$username"
            params={{ username: profile.login }}
            className="truncate text-ui font-medium text-foreground hover:text-primary"
          >
            {profile.name || profile.login}
          </Link>
          <span className="truncate font-mono text-caption text-muted-foreground">
            @{profile.login}
          </span>
        </div>
      </div>
      {profile.bio && (
        <p className="line-clamp-2 text-caption text-muted-foreground">{profile.bio}</p>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted-foreground">
        {profile.company && (
          <span className="inline-flex min-w-0 items-center gap-1">
            <Buildings className="size-3 shrink-0" />
            <span className="max-w-30 truncate">{profile.company}</span>
          </span>
        )}
        {profile.location && (
          <span className="inline-flex min-w-0 items-center gap-1">
            <MapPin className="size-3 shrink-0" />
            <span className="max-w-30 truncate">{profile.location}</span>
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <PeopleIcon className="size-3" />
          {profile.followers}
        </span>
        <span className="inline-flex items-center gap-1">
          <RepoIcon className="size-3" />
          {profile.public_repos}
        </span>
      </div>
    </div>
  );
}

// ─── Issue/PR card ────────────────────────────────────────────────────────

function IssueCard({ owner, repo, number }: { owner: string; repo: string; number: number }) {
  const token = useAuthStore((s) => s.token);
  const { data: issue, isPending } = useQuery({
    queryKey: issueKeys.detail(owner, repo, number),
    enabled: !!token && !!owner && !!repo && !!number,
    staleTime: 30_000,
    queryFn: async (): Promise<RepoIssue> => {
      const client = getGitHubClient();
      const res = await client.request("GET /repos/{owner}/{repo}/issues/{issue_number}", {
        owner,
        repo,
        issue_number: number,
      });
      return IssueDetailSchema.parse(res.data);
    },
  });

  if (isPending) return <CardSkeleton />;
  if (!issue) return <CardError>Couldn't load #{number}.</CardError>;

  const isPR = !!issue.pull_request;
  const isOpen = issue.state === "open";
  const description = snippet(issue.body);
  const titleClass =
    "line-clamp-2 text-ui font-medium leading-snug text-foreground text-pretty hover:text-primary";

  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex min-w-0 items-center gap-2 text-caption text-muted-foreground">
        {isPR ? (
          <GitPullRequestIcon
            className={cn(
              "size-3.5 shrink-0",
              isOpen ? "text-(--color-success)" : "text-(--color-pr-merged)",
            )}
          />
        ) : isOpen ? (
          <IssueOpenedIcon className="size-3.5 shrink-0 text-(--color-success)" />
        ) : (
          <IssueClosedIcon className="size-3.5 shrink-0 text-(--color-pr-merged)" />
        )}
        <span className="min-w-0 flex-1 truncate font-mono">
          {owner}/{repo}#{number}
        </span>
        <span className="shrink-0 text-(--color-fg-faint)">
          {formatRelativeTime(issue.created_at)}
        </span>
      </div>

      {isPR ? (
        <Link
          to="/$owner/$repo/pull/$number"
          params={{ owner, repo, number }}
          className={titleClass}
        >
          {issue.title}
        </Link>
      ) : (
        <Link
          to="/$owner/$repo/issues/$number"
          params={{ owner, repo, number }}
          className={titleClass}
        >
          {issue.title}
        </Link>
      )}

      {description && (
        <p className="line-clamp-2 text-caption text-muted-foreground">{description}</p>
      )}

      {issue.labels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {issue.labels.slice(0, 4).map((l) => (
            <LabelPill key={l.id} label={l} size="xs" />
          ))}
          {issue.labels.length > 4 && (
            <span className="text-caption text-muted-foreground">+{issue.labels.length - 4}</span>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 text-caption text-muted-foreground">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <Avatar login={issue.user.login} avatarUrl={issue.user.avatar_url} size="xs" />
          <span className="truncate">{issue.user.login}</span>
        </span>
        {issue.comments > 0 && (
          <span className="inline-flex items-center gap-1">
            <CommentIcon className="size-3" />
            {issue.comments}
          </span>
        )}
      </div>
    </div>
  );
}
