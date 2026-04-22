import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, GitBranch } from "lucide-react";
import { useMemo } from "react";
import { CommitRow } from "@/app/components/repo/CommitRow";
import { StatusMessage } from "@/app/components/StatusMessage";
import { Container } from "@/app/components/ui/Container";
import { Skeleton } from "@/app/components/ui/skeleton";
import { repoQueryOptions, useRepo } from "@/app/hooks/useRepo";
import { useRepoCommits } from "@/app/hooks/useRepoCommits";
import { formatFullDate, groupByDay } from "@/app/lib/time";

export const Route = createFileRoute("/$owner/$repo/commits")({
  // Non-blocking prefetch. Only the repo query fires here; the commits
  // query needs `repo.default_branch` which the component derives once
  // the repo data arrives. Component owns skeleton state end-to-end.
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(
      repoQueryOptions(params.owner, params.repo),
    );
  },
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
      <section className="overflow-hidden rounded-lg border border-input bg-muted">
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5 sm:px-5">
          <div className="flex items-baseline gap-2">
            <h1 className="font-mono text-ui font-medium uppercase tracking-widest text-foreground">
              Commits
            </h1>
            {commits && (
              <span className="font-mono text-micro uppercase tracking-widest text-[var(--color-fg-faint)]">
                {commits.length}
              </span>
            )}
          </div>
          {branch && (
            <span className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-background px-2 py-0.5 font-mono text-micro text-muted-foreground">
              <GitBranch className="size-3" />
              {branch}
            </span>
          )}
        </header>

        <div className="bg-background">
          {isPending ? (
            <CommitListSkeleton />
          ) : isError ? (
            <div className="px-5 py-10 text-center">
              <AlertCircle className="mx-auto mb-2 size-5 text-destructive" />
              <p className="text-sm text-muted-foreground">Could not load commits.</p>
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
    <div className="sticky top-0 z-[1] flex items-baseline gap-2 border-y border-border bg-muted px-4 py-1.5 sm:px-5">
      <span className="font-mono text-micro uppercase tracking-widest text-muted-foreground">
        Commits on {formatFullDate(iso)}
      </span>
      <span className="font-mono text-micro tabular-nums text-[var(--color-fg-faint)]">
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
          className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-b-0"
        >
          <div className="min-w-0 flex-1 flex flex-col gap-1.5">
            <Skeleton className="h-4" style={{ width: `${45 + (i * 11) % 40}%` }} />
            <Skeleton className="h-3 w-40" />
          </div>
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </div>
  );
}
