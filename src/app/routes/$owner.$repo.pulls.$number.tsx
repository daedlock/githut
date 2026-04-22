import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
import { Container } from "@/app/components/ui/Container";
import { Skeleton } from "@/app/components/ui/skeleton";
import { PrHeader } from "@/app/features/pulls/components/PrHeader";
import { PrSubTabs } from "@/app/features/pulls/components/PrSubTabs";
import { prDetailQueryOptions, useFullPr } from "@/app/features/pulls/hooks";

export const Route = createFileRoute("/$owner/$repo/pulls/$number")({
  parseParams: (raw) => ({ number: Number(raw.number) }),
  // Non-blocking prefetch so cold-nav shows the skeleton instead of a
  // blank frame. The header reads from the same cache on mount.
  loader: ({ context, params }) => {
    if (!Number.isFinite(params.number)) return;
    void context.queryClient.prefetchQuery(
      prDetailQueryOptions(params.owner, params.repo, params.number),
    );
  },
  component: PrDetailLayout,
});

function PrDetailLayout() {
  const { owner, repo, number } = Route.useParams();
  const prQuery = useFullPr(owner, repo, number);
  const pr = prQuery.data;

  if (prQuery.isPending) {
    return (
      <Container className="py-5 sm:py-6">
        <PrHeaderSkeleton />
      </Container>
    );
  }

  if (prQuery.isError || !pr) {
    return (
      <Container className="py-10">
        <div className="flex flex-col items-center gap-2 text-center">
          <AlertCircle className="size-5 text-destructive" />
          <p className="text-body text-muted-foreground">
            {prQuery.isError ? "Could not load this pull request." : "Pull request not found."}
          </p>
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-5 sm:py-6">
      <PrHeader owner={owner} repo={repo} pr={pr} />
      <PrSubTabs
        owner={owner}
        repo={repo}
        number={number}
        counts={{
          conversation: pr.comments + pr.review_comments,
          files: pr.changed_files,
          commits: pr.commits,
        }}
      />
      <Outlet />
    </Container>
  );
}

function PrHeaderSkeleton() {
  return (
    <div className="skeleton-fade">
      <Skeleton className="mb-4 h-4 w-28" />
      <Skeleton className="mb-3 h-7 w-3/4" />
      <div className="mb-2 flex items-center gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-4 w-60" />
      </div>
      <Skeleton className="h-3 w-48" />
      <div className="mt-5 flex gap-4 border-b border-border pb-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  );
}
