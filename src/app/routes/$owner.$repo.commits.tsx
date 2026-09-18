import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
import { useMemo } from "react";
import { z } from "zod";
import { BranchSelector } from "@/app/components/repo/BranchSelector";
import { CommitRow } from "@/app/components/repo/CommitRow";
import { Button } from "@/app/components/ui/button";
import { Container } from "@/app/components/ui/Container";
import { Skeleton } from "@/app/components/ui/skeleton";
import { repoQueryOptions, useRepo } from "@/app/hooks/useRepo";
import { repoBranchesQueryOptions, useRepoBranches } from "@/app/hooks/useRepoBranches";
import { useInfiniteRepoCommits } from "@/app/hooks/useRepoCommits";
import { useListNavigation } from "@/app/hooks/useListNavigation";
import { formatFullDate, groupByDay } from "@/app/lib/time";

const commitsSearchSchema = z.object({
  branch: z.string().optional(),
});

export const Route = createFileRoute("/$owner/$repo/commits")({
  validateSearch: commitsSearchSchema,
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(repoQueryOptions(params.owner, params.repo));
    void context.queryClient.prefetchQuery(repoBranchesQueryOptions(params.owner, params.repo));
  },
  component: CommitsPage,
});

function CommitsPage() {
  const { owner, repo } = Route.useParams();
  const { branch: searchBranch } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: repoData } = useRepo(owner, repo);
  const branchesQuery = useRepoBranches(owner, repo);
  const defaultBranch = repoData?.default_branch;
  const branch = searchBranch ?? defaultBranch;
  const commitsQuery = useInfiniteRepoCommits(owner, repo, branch);
  const commits = useMemo(() => commitsQuery.data?.pages.flat() ?? [], [commitsQuery.data]);

  const grouped = useMemo(() => groupByDay(commits, (c) => c.commit.author.date), [commits]);
  useListNavigation(!commitsQuery.isPending && !commitsQuery.isError);

  return (
    <Container className="py-6">
      {/* Toolbar — sits on subtle surface */}
      <div className="mb-2 flex items-center justify-between gap-3 rounded-lg bg-muted px-2 py-1">
        <div className="flex items-center gap-3">
          <h1 className="text-caption font-medium text-foreground">Commits</h1>
          {commits && (
            <span className="tabular-nums text-caption text-muted-foreground">
              {commits.length}
            </span>
          )}
        </div>
        <BranchSelector
          branches={branchesQuery.data}
          value={branch}
          defaultBranch={defaultBranch}
          isLoading={branchesQuery.isPending}
          onChange={(nextBranch) => {
            navigate({
              search: (prev) => ({
                ...prev,
                branch: nextBranch === defaultBranch ? undefined : nextBranch,
              }),
            });
          }}
        />
      </div>

      {/* Commit list — flat rows, hover surface shift */}
      <div className="flex flex-col gap-1">
        {commitsQuery.isPending ? (
          <CommitListSkeleton />
        ) : commitsQuery.isError ? (
          <div className="px-5 py-10 text-center">
            <AlertCircle className="mx-auto mb-2 size-5 text-destructive" />
            <p className="text-body text-muted-foreground">Could not load commits.</p>
          </div>
        ) : grouped.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-body text-muted-foreground">No commits yet.</p>
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

      {commitsQuery.hasNextPage && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => commitsQuery.fetchNextPage()}
            disabled={commitsQuery.isFetchingNextPage}
          >
            {commitsQuery.isFetchingNextPage ? "Loading…" : "Load older commits"}
          </Button>
        </div>
      )}
    </Container>
  );
}

function DayHeader({ iso, count }: { iso: string; count: number }) {
  return (
    <div className="flex items-baseline gap-2 px-3 pt-4 pb-1">
      <span className="text-caption font-medium text-muted-foreground">{formatFullDate(iso)}</span>
      <span className="tabular-nums text-micro text-[var(--color-fg-faint)]">{count}</span>
    </div>
  );
}

const COMMIT_SKELETON_WIDTHS = ["45%", "56%", "67%", "78%", "49%", "60%", "71%", "82%"] as const;

function CommitListSkeleton() {
  return (
    <div className="skeleton-fade flex flex-col gap-1 pt-4">
      {COMMIT_SKELETON_WIDTHS.map((width) => (
        <div key={width} className="flex items-start gap-3 px-3 py-2.5">
          <div className="min-w-0 flex-1 flex flex-col gap-1.5">
            <Skeleton className="h-3.5" style={{ width }} />
            <Skeleton className="h-3 w-40" />
          </div>
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </div>
  );
}
