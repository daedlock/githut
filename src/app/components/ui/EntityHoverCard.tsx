import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  BookMarked,
  Building2,
  CheckCircle2,
  CircleDot,
  CircleSlash,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  MapPin,
  Users,
} from "lucide-react";
import { Avatar } from "@/app/components/ui/avatar";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/app/components/ui/hover-card";
import { Skeleton, SkeletonGroup } from "@/app/components/ui/skeleton";
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

// ─── User card ────────────────────────────────────────────────────────────

function UserCard({ login }: { login: string }) {
  const token = useAuthStore((s) => s.token);
  const { data: profile, isPending } = useQuery({
    ...profileQueryOptions(login),
    enabled: !!token && !!login,
  });

  if (isPending) {
    return (
      <SkeletonGroup label="Loading profile" className="p-3">
        <div className="flex items-start gap-3">
          <Skeleton className="size-7 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex h-4.5 items-center">
              <Skeleton className="h-3 w-24" />
            </div>
            <div className="flex h-4 items-center">
              <Skeleton className="h-2.5 w-16" />
            </div>
          </div>
        </div>
        <div className="mt-2.5 flex h-4 items-center">
          <Skeleton className="h-2.5 w-40" />
        </div>
      </SkeletonGroup>
    );
  }

  if (!profile) {
    return <p className="p-3 text-center text-ui text-muted-foreground">Could not load profile</p>;
  }

  return (
    <div className="p-3">
      <div className="flex items-start gap-3">
        <Avatar login={profile.login} avatarUrl={profile.avatar_url} size="lg" />
        <div className="min-w-0 flex-1">
          {profile.name && (
            <Link
              to="/$username"
              params={{ username: profile.login }}
              className="block truncate text-ui font-medium text-foreground hover:text-primary"
            >
              {profile.name}
            </Link>
          )}
          <Link
            to="/$username"
            params={{ username: profile.login }}
            className="block truncate text-caption text-muted-foreground hover:text-primary"
          >
            @{profile.login}
          </Link>
        </div>
      </div>
      {profile.bio && (
        <p className="mt-2 line-clamp-2 text-caption text-muted-foreground">{profile.bio}</p>
      )}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted-foreground">
        {profile.company && (
          <span className="inline-flex min-w-0 items-center gap-1">
            <Building2 aria-hidden className="size-3 shrink-0 text-(--color-fg-faint)" />
            <span className="max-w-32 truncate">{profile.company}</span>
          </span>
        )}
        {profile.location && (
          <span className="inline-flex min-w-0 items-center gap-1">
            <MapPin aria-hidden className="size-3 shrink-0 text-(--color-fg-faint)" />
            <span className="max-w-32 truncate">{profile.location}</span>
          </span>
        )}
        <span className="inline-flex items-center gap-1 tabular-nums">
          <Users aria-hidden className="size-3 text-(--color-fg-faint)" />
          {profile.followers}
          <span className="sr-only">followers</span>
        </span>
        <span className="inline-flex items-center gap-1 tabular-nums">
          <BookMarked aria-hidden className="size-3 text-(--color-fg-faint)" />
          {profile.public_repos}
          <span className="sr-only">repositories</span>
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
      <SkeletonGroup label={`Loading #${number}`} className="p-3">
        <div className="flex h-4 items-center gap-2">
          <Skeleton className="size-3.5 shrink-0 rounded-full" />
          <Skeleton className="h-2.5 w-28" />
        </div>
        <div className="mt-1.5 flex h-4.5 items-center">
          <Skeleton className="h-3 w-3/4" />
        </div>
        <div className="mt-2 flex h-5 items-center gap-2">
          <Skeleton className="size-5 shrink-0 rounded-full" />
          <Skeleton className="h-2.5 w-24" />
        </div>
      </SkeletonGroup>
    );
  }

  if (!issue) {
    return (
      <p className="p-3 text-center text-ui text-muted-foreground">Could not load #{number}</p>
    );
  }

  const isPR = !!issue.pull_request;
  const isOpen = issue.state === "open";
  const merged = !!issue.pull_request?.merged_at;
  const StateIcon = isPR
    ? merged
      ? GitMerge
      : isOpen
        ? GitPullRequest
        : GitPullRequestClosed
    : isOpen
      ? CircleDot
      : issue.state_reason === "not_planned"
        ? CircleSlash
        : CheckCircle2;
  const stateTone = isOpen
    ? "text-(--color-success)"
    : !isPR
      ? "text-(--color-fg-faint)"
      : merged
        ? "text-(--color-pr-merged)"
        : "text-destructive";
  const titleClass =
    "mt-1.5 line-clamp-2 block text-ui font-medium text-foreground hover:text-primary";

  return (
    <div className="p-3">
      {/* State + number */}
      <div className="flex items-center gap-2">
        <StateIcon aria-hidden className={cn("size-3.5 shrink-0", stateTone)} />
        <span className="truncate font-mono text-caption text-muted-foreground">
          {owner}/{repo}#{number}
        </span>
      </div>

      {/* Title */}
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

      {/* Meta */}
      <div className="mt-2 flex items-center gap-2 text-caption text-muted-foreground">
        <Avatar login={issue.user.login} avatarUrl={issue.user.avatar_url} size="sm" />
        <span className="truncate">{issue.user.login}</span>
        <span aria-hidden className="opacity-50">
          ·
        </span>
        <span className="shrink-0 tabular-nums">{formatRelativeTime(issue.created_at)}</span>
      </div>

      {/* Labels */}
      {issue.labels.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {issue.labels.slice(0, 4).map((l) => (
            <LabelPill key={l.id} label={l} size="xs" />
          ))}
          {issue.labels.length > 4 && (
            <span className="text-caption tabular-nums text-muted-foreground">
              +{issue.labels.length - 4}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
