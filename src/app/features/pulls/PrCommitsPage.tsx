import { Link } from "@tanstack/react-router";
import { AlertCircle, GitCommit } from "lucide-react";
import { Skeleton } from "@/app/components/ui/skeleton";
import { ShaChip } from "@/app/components/ui/ShaChip";
import { ProfileLink } from "@/app/components/user/ProfileLink";
import { usePrCommits } from "@/app/features/pulls/hooks";
import type { PrCommit } from "@/app/features/pulls/hooks";
import { formatRelativeTime } from "@/app/lib/time";

// ─── PrCommitsPage ─────────────────────────────────────────────────────────
//
// Flat list of the commits attached to the PR (oldest → newest per
// GitHub's ordering). Each row links to the full commit detail view so
// reviewers can step into a single commit's diff. Visual rhythm mirrors
// the repo-wide commits page: title + body, short SHA chip, author meta.
//
// Not reusing `CommitRow` directly because its type is
// `CommitSummary` (from `useRepoCommits`). The PR commit shape is
// structurally identical but lives in its own zod type — a thin local
// row keeps the dependency clean.

export type PrCommitsPageProps = {
  owner: string;
  repo: string;
  number: number;
};

export function PrCommitsPage({ owner, repo, number }: PrCommitsPageProps) {
  const commitsQuery = usePrCommits(owner, repo, number);

  if (commitsQuery.isPending) return <PrCommitsSkeleton />;
  if (commitsQuery.isError) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <AlertCircle className="size-5 text-destructive" />
        <p className="text-body text-muted-foreground">
          Could not load commits for this pull request.
        </p>
      </div>
    );
  }

  const commits = commitsQuery.data ?? [];
  if (commits.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <GitCommit className="size-5 text-[var(--color-fg-faint)]" />
        <p className="text-body text-muted-foreground">No commits on this pull request.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-border">
      {commits.map((commit) => (
        <PrCommitRow key={commit.sha} commit={commit} owner={owner} repo={repo} />
      ))}
    </div>
  );
}

function PrCommitRow({
  commit,
  owner,
  repo,
}: {
  commit: PrCommit;
  owner: string;
  repo: string;
}) {
  const { title, body } = splitMessage(commit.commit.message);
  const displayAuthor = commit.author?.login ?? commit.commit.author.name;
  const authorLogin = commit.author?.login;

  return (
    <div className="group flex items-start gap-3 border-b border-border px-4 py-3 last:border-b-0 transition-colors hover:bg-muted">
      <div className="min-w-0 flex-1">
        <Link
          to="/$owner/$repo/commit/$sha"
          params={{ owner, repo, sha: commit.sha }}
          className="block rounded-sm outline-none focus-visible:ring-1 focus-visible:ring-foreground/15"
        >
          <div className="text-body font-medium text-foreground truncate">{title}</div>
          {body && (
            <pre className="mt-1 whitespace-pre-wrap font-mono text-caption text-muted-foreground">
              {body}
            </pre>
          )}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-caption text-[var(--color-fg-faint)]">
          {authorLogin ? (
            <ProfileLink login={authorLogin} className="text-muted-foreground">
              {displayAuthor}
            </ProfileLink>
          ) : (
            <span className="text-muted-foreground">{displayAuthor}</span>
          )}
          <span>committed {formatRelativeTime(commit.commit.author.date)}</span>
        </div>
      </div>
      <ShaChip sha={commit.sha} variant="inline" />
    </div>
  );
}

function splitMessage(msg: string): { title: string; body: string } {
  const firstNewline = msg.indexOf("\n");
  if (firstNewline === -1) return { title: msg, body: "" };
  return {
    title: msg.slice(0, firstNewline),
    body: msg.slice(firstNewline + 1).trim(),
  };
}

function PrCommitsSkeleton() {
  return (
    <div className="skeleton-fade overflow-hidden rounded-md border border-border">
      {[80, 60, 72].map((w) => (
        <div
          key={w}
          className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-b-0"
        >
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4" style={{ width: `${w}%` }} />
            <Skeleton className="mt-2 h-3 w-48" />
          </div>
          <Skeleton className="h-5 w-20" />
        </div>
      ))}
    </div>
  );
}
