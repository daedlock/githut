import { AlertCircle } from "lucide-react";
import { CommitRow } from "@/app/components/repo/CommitRow";
import { Button } from "@/app/components/ui/button";
import { Skeleton, SkeletonGroup } from "@/app/components/ui/skeleton";
import { useRepoFileHistory } from "@/app/hooks/useRepoFileHistory";

export function FileHistoryPanel({
  owner,
  repo,
  path,
  branch,
  showHeader = true,
}: {
  owner: string;
  repo: string;
  path: string;
  branch?: string;
  showHeader?: boolean;
}) {
  const historyQuery = useRepoFileHistory(owner, repo, path, branch);
  const commits = historyQuery.data?.pages.flat() ?? [];

  return (
    <div className="bg-background">
      {showHeader && (
        <div className="mb-2 flex h-9 items-center justify-between gap-3 rounded-lg bg-muted px-3">
          <div className="min-w-0">
            <h2 className="text-caption font-medium text-foreground">File history</h2>
            <p className="truncate font-mono text-caption text-muted-foreground">{path}</p>
          </div>
          {commits.length > 0 && (
            <span className="font-mono text-caption tabular-nums text-muted-foreground">
              {commits.length}
            </span>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1 p-1.5">
        {historyQuery.isPending ? (
          <HistorySkeleton />
        ) : historyQuery.isError ? (
          <div className="px-5 py-10 text-center">
            <AlertCircle className="mx-auto mb-2 size-5 text-destructive" />
            <p className="text-body text-muted-foreground">Could not load file history.</p>
          </div>
        ) : commits.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-body text-muted-foreground">No commits found for this file.</p>
          </div>
        ) : (
          commits.map((commit) => (
            <CommitRow key={commit.sha} commit={commit} owner={owner} repo={repo} />
          ))
        )}
      </div>

      {historyQuery.hasNextPage && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => historyQuery.fetchNextPage()}
            disabled={historyQuery.isFetchingNextPage}
          >
            {historyQuery.isFetchingNextPage ? "Loading…" : "Load older commits"}
          </Button>
        </div>
      )}
    </div>
  );
}

const HISTORY_SKELETON_WIDTHS = ["45%", "58%", "71%", "49%", "62%", "75%"] as const;

function HistorySkeleton() {
  return (
    <SkeletonGroup label="Loading file history" className="skeleton-fade flex flex-col gap-1 pt-2">
      {HISTORY_SKELETON_WIDTHS.map((width) => (
        <div key={width} className="flex items-start gap-3 px-3 py-2.5">
          <div className="min-w-0 flex-1 flex flex-col gap-1.5">
            <Skeleton className="h-3.5" style={{ width }} />
            <Skeleton className="h-3 w-40" />
          </div>
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </SkeletonGroup>
  );
}
