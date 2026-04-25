import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, GitBranch } from "lucide-react";
import { useMemo } from "react";
import { CommitRow } from "@/app/components/repo/CommitRow";
import { Container } from "@/app/components/ui/Container";
import { Skeleton } from "@/app/components/ui/skeleton";
import { repoQueryOptions, useRepo } from "@/app/hooks/useRepo";
import { useRepoCommits } from "@/app/hooks/useRepoCommits";
import { formatFullDate, groupByDay } from "@/app/lib/time";

export const Route = createFileRoute("/$owner/$repo/commits")({
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
    <Container className="py-6">
      {/* Toolbar */}
      <div className="mb-2 flex items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2">
        <div className="flex items-baseline gap-2">
          <span className="text-caption font-medium text-foreground">Commits</span>
          {commits && (
            <span className="text-caption tabular-nums text-muted-foreground">
              {commits.length}
            </span>
          )}
        </div>
        {branch && (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-background px-2 py-0.5 font-mono text-caption text-muted-foreground">
            <GitBranch className="size-3" />
            {branch}
          </span>
        )}
      </div>

      {/* Commit list */}
      {isPending ? (
        <CommitListSkeleton />
      ) : isError ? (
        <div className="py-16 text-center">
          <AlertCircle className="mx-auto mb-2 size-5 text-destructive" />
          <p className="text-body text-muted-foreground">Could not load commits.</p>
        </div>
      ) : grouped.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-body text-muted-foreground">No commits yet.</p>
        </div>
      ) : (
        <div className="flex flex-col">
          {grouped.map((group) => (
            <div key={group.key}>
              <DayHeader iso={group.iso} count={group.items.length} />
              {group.items.map((commit) => (
                <CommitRow key={commit.sha} commit={commit} owner={owner} repo={repo} />
              ))}
            </div>
          ))}
        </div>
      )}
    </Container>
  );
}

function DayHeader({ iso, count }: { iso: string; count: number }) {
  return (
    <div className="mt-1 first:mt-0 flex items-baseline gap-2 rounded-lg bg-muted px-3 py-2.5">
      <span className="text-caption text-muted-foreground">
        {formatFullDate(iso)}
      </span>
      <span className="text-caption tabular-nums text-[var(--color-fg-faint)]">
        {count}
      </span>
    </div>
  );
}

function CommitListSkeleton() {
  return (
    <div className="skeleton-fade flex flex-col gap-0 pt-4">
      {Array.from({ length: 8 }).map((_, i) => (
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
