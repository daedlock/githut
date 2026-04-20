import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, GitBranch } from "lucide-react";
import { useMemo } from "react";
import { CommitRow } from "@/app/components/repo/CommitRow";
import { StatusMessage } from "@/app/components/StatusMessage";
import { Container } from "@/app/components/ui/Container";
import { Skeleton } from "@/app/components/ui/Skeleton";
import { useRepo } from "@/app/hooks/useRepo";
import { useRepoCommits } from "@/app/hooks/useRepoCommits";
import { formatFullDate, groupByDay } from "@/app/lib/time";

export const Route = createFileRoute("/$owner/$repo/commits")({
  component: CommitsPage,
});

function CommitsPage() {
  const { owner, repo } = Route.useParams();
  const { data: repoData } = useRepo(owner, repo);
  const branch = repoData?.default_branch;
  const { data: commits, isPending, isError } = useRepoCommits(owner, repo, branch);

  const grouped = useMemo(
    () => groupByDay(commits ?? [], (c) => c.commit.author.date),
    [commits],
  );

  return (
    <Container className="py-5 sm:py-6">
      <section className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-bg-subtle)]">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-2.5 sm:px-5">
          <div className="flex items-baseline gap-2">
            <h1 className="font-mono text-xs font-medium uppercase tracking-widest text-[var(--color-fg)]">
              Commits
            </h1>
            {commits && (
              <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-fg-faint)]">
                {commits.length}
              </span>
            )}
          </div>
          {branch && (
            <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-0.5 font-mono text-[11px] text-[var(--color-fg-muted)]">
              <GitBranch className="h-3 w-3" />
              {branch}
            </span>
          )}
        </header>

        <div className="bg-[var(--color-bg)]">
          {isPending ? (
            <CommitListSkeleton />
          ) : isError ? (
            <div className="px-5 py-10 text-center">
              <AlertCircle className="mx-auto mb-2 h-5 w-5 text-[var(--color-danger)]" />
              <p className="text-sm text-[var(--color-fg-muted)]">Could not load commits.</p>
            </div>
          ) : grouped.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <StatusMessage>No commits yet.</StatusMessage>
            </div>
          ) : (
            grouped.map((group) => (
              <div key={group.key}>
                <DayHeader iso={group.iso} count={group.items.length} />
                {group.items.map((commit) => (
                  <CommitRow key={commit.sha} commit={commit} owner={owner} repo={repo} />
                ))}
              </div>
            ))
          )}
        </div>
      </section>
    </Container>
  );
}

function DayHeader({ iso, count }: { iso: string; count: number }) {
  return (
    <div className="sticky top-0 z-[1] flex items-baseline gap-2 border-y border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-4 py-1.5 sm:px-5">
      <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-fg-muted)]">
        Commits on {formatFullDate(iso)}
      </span>
      <span className="font-mono text-[10px] tabular-nums text-[var(--color-fg-faint)]">
        {count}
      </span>
    </div>
  );
}

function CommitListSkeleton() {
  return (
    <div className="skeleton-fade">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex items-start gap-3 border-b border-[var(--color-border)] px-4 py-3 last:border-b-0"
        >
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-4" style={{ width: `${45 + (i * 11) % 40}%` }} />
            <Skeleton className="h-3 w-40" />
          </div>
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </div>
  );
}
