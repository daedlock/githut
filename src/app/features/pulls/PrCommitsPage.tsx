import { Link } from "@tanstack/react-router";
import { AlertCircle, GitCommit } from "lucide-react";
import { useState } from "react";
import { ShaChip } from "@/app/components/ui/ShaChip";
import { Skeleton } from "@/app/components/ui/skeleton";
import { usePrCommits } from "@/app/features/pulls/hooks";
import type { PrCommit } from "@/app/features/pulls/hooks";
import { cn } from "@/app/lib/cn";
import { formatRelativeTime } from "@/app/lib/time";

export type PrCommitsPageProps = {
  owner: string;
  repo: string;
  number: number;
};

export function PrCommitsPage({ owner, repo, number }: PrCommitsPageProps) {
  const commitsQuery = usePrCommits(owner, repo, number);

  if (commitsQuery.isPending) return <CommitsSkeleton />;
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
    <div className="flex flex-col gap-1">
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
  const [bodyOpen, setBodyOpen] = useState(false);
  const { title, body } = splitMessage(commit.commit.message);
  const displayAuthor = commit.author?.login ?? commit.commit.author.name;
  const authorLogin = commit.author?.login;
  const avatar = commit.author?.avatar_url;

  return (
    <div className="group flex items-start gap-3 px-3 py-2.5 transition-colors hover:bg-muted rounded-lg">
      {/* Left: title + meta */}
      <div className="min-w-0 flex-1">
        <Link
          to="/$owner/$repo/commit/$sha"
          params={{ owner, repo, sha: commit.sha }}
          className="block outline-none rounded-sm focus-visible:ring-1 focus-visible:ring-foreground/15"
        >
          <p className="text-body font-[475] text-foreground leading-snug">
            {title}
            {body && !bodyOpen && (
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setBodyOpen(true); }}
                className="ml-1.5 inline-flex rounded-md bg-muted px-1.5 py-px text-micro text-muted-foreground transition-colors hover:text-foreground"
                aria-expanded={false}
              >
                ···
              </button>
            )}
          </p>
        </Link>

        {body && bodyOpen && (
          <>
            <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-muted p-3 font-mono text-caption leading-relaxed text-muted-foreground">
              {body}
            </pre>
            <button
              type="button"
              onClick={() => setBodyOpen(false)}
              className="mt-1 rounded-md bg-muted px-1.5 py-px text-micro text-muted-foreground transition-colors hover:text-foreground"
            >
              collapse
            </button>
          </>
        )}

        {/* Author + time */}
        <div className="mt-1 flex items-center gap-2 text-ui text-muted-foreground">
          {avatar ? (
            <img
              src={avatar}
              alt=""
              loading="lazy"
              decoding="async"
              className="size-5 shrink-0 rounded-full"
            />
          ) : (
            <GitCommit className="size-3 shrink-0 text-[var(--color-fg-faint)]" />
          )}
          <span className="truncate font-[475]">{displayAuthor}</span>
          <span className="text-[var(--color-fg-faint)]">
            {formatRelativeTime(commit.commit.author.date)}
          </span>
        </div>
      </div>

      {/* Right: SHA */}
      <ShaChip sha={commit.sha} link={{ owner, repo }} />
    </div>
  );
}

function splitMessage(message: string): { title: string; body: string } {
  const trimmed = message.trim();
  const splitIdx = trimmed.indexOf("\n\n");
  if (splitIdx === -1) return { title: trimmed, body: "" };
  return {
    title: trimmed.slice(0, splitIdx).trim(),
    body: trimmed.slice(splitIdx + 2).trim(),
  };
}

function CommitsSkeleton() {
  return (
    <div className="skeleton-fade flex flex-col gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 px-3 py-2.5">
          <div className="min-w-0 flex-1 flex flex-col gap-1.5">
            <Skeleton className="h-3.5" style={{ width: `${45 + (i * 11) % 40}%` }} />
            <Skeleton className="h-3 w-40" />
          </div>
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </div>
  );
}
