import { Buildings, MapPin } from "@phosphor-icons/react";
import {
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
  | { kind: "issue"; owner: string; repo: string; number: number };

export function detectEntity(href: string, text: string): EntityRef | null {
  // @username — text starts with @, href points to github.com/<user>
  if (typeof text === "string" && text.startsWith("@")) {
    const login = text.slice(1);
    if (login && /^[a-zA-Z0-9_-]+$/.test(login)) {
      return { kind: "mention", login };
    }
  }

  // #123 — text starts with #, href points to github.com/<owner>/<repo>/issues/<n>
  if (typeof text === "string" && /^#\d+$/.test(text)) {
    try {
      const url = new URL(href);
      if (url.hostname !== "github.com") return null;
      const m = url.pathname.match(/^\/([^/]+)\/([^/]+)\/(?:issues|pull)\/(\d+)/);
      if (m) return { kind: "issue", owner: m[1]!, repo: m[2]!, number: Number(m[3]) };
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
  const to =
    entity.kind === "mention" ? `/${entity.login}` : `/${entity.owner}/${entity.repo}/issues`;
  const search = entity.kind === "issue" ? { issue: entity.number } : undefined;

  return (
    <HoverCard openDelay={300} closeDelay={100}>
      <HoverCardTrigger asChild>
        <Link to={to} search={search} {...rest}>
          {children}
        </Link>
      </HoverCardTrigger>
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

// ─── User card ────────────────────────────────────────────────────────────

function UserCard({ login }: { login: string }) {
  const token = useAuthStore((s) => s.token);
  const { data: profile, isPending } = useQuery({
    ...profileQueryOptions(login),
    enabled: !!token && !!login,
  });

  if (isPending) {
    return (
      <div className="p-3">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-2.5 w-16" />
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-3 text-center text-xs text-muted-foreground">Could not load profile</div>
    );
  }

  return (
    <div className="animate-in fade-in-0 duration-150 p-3">
      <div className="flex items-start gap-3">
        <Avatar login={profile.login} avatarUrl={profile.avatar_url} size="lg" />
        <div className="min-w-0 flex-1">
          {profile.name && (
            <Link
              to="/$username"
              params={{ username: profile.login }}
              className="block truncate text-xs font-medium text-foreground hover:text-[var(--color-accent)]"
            >
              {profile.name}
            </Link>
          )}
          <Link
            to="/$username"
            params={{ username: profile.login }}
            className="block truncate text-xs text-muted-foreground hover:text-[var(--color-accent)]"
          >
            @{profile.login}
          </Link>
        </div>
      </div>
      {profile.bio && <p className="mt-2 line-clamp-2 text-xs text-foreground/80">{profile.bio}</p>}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {profile.company && (
          <span className="inline-flex items-center gap-1">
            <Buildings className="size-3" />
            <span className="truncate max-w-[120px]">{profile.company}</span>
          </span>
        )}
        {profile.location && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3" />
            <span className="truncate max-w-[120px]">{profile.location}</span>
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

  if (isPending) {
    return (
      <div className="p-3 space-y-2">
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-2.5 w-1/2" />
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="p-3 text-center text-xs text-muted-foreground">Could not load #{number}</div>
    );
  }

  const isPR = !!issue.pull_request;
  const isOpen = issue.state === "open";

  return (
    <div className="p-3">
      {/* State + number */}
      <div className="flex items-center gap-2">
        {isPR ? (
          <GitPullRequestIcon
            className={cn(
              "size-3.5 shrink-0",
              isOpen ? "text-[var(--color-success)]" : "text-[var(--color-pr-merged)]",
            )}
          />
        ) : isOpen ? (
          <IssueOpenedIcon className="size-3.5 shrink-0 text-[var(--color-success)]" />
        ) : (
          <IssueClosedIcon className="size-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="font-mono text-xs text-muted-foreground">
          {owner}/{repo}#{number}
        </span>
      </div>

      {/* Title */}
      {isPR ? (
        <Link
          to="/$owner/$repo/pulls/$number"
          params={{ owner, repo, number }}
          className="mt-1.5 block line-clamp-2 text-xs font-medium text-foreground leading-relaxed hover:text-[var(--color-accent)]"
        >
          {issue.title}
        </Link>
      ) : (
        <Link
          to="/$owner/$repo/issues"
          params={{ owner, repo }}
          search={{ issue: number }}
          className="mt-1.5 block line-clamp-2 text-xs font-medium text-foreground leading-relaxed hover:text-[var(--color-accent)]"
        >
          {issue.title}
        </Link>
      )}

      {/* Meta */}
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Avatar login={issue.user.login} avatarUrl={issue.user.avatar_url} size="sm" />
        <span>{issue.user.login}</span>
        <span>·</span>
        <span>{formatRelativeTime(issue.created_at)}</span>
      </div>

      {/* Labels */}
      {issue.labels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {issue.labels.slice(0, 4).map((l) => (
            <LabelPill key={l.id} label={l} size="xs" />
          ))}
          {issue.labels.length > 4 && (
            <span className="text-xs text-muted-foreground">+{issue.labels.length - 4}</span>
          )}
        </div>
      )}
    </div>
  );
}
