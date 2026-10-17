import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
import { Container } from "@/app/components/ui/Container";
import { MetadataSkeleton } from "@/app/components/ui/MetadataSkeleton";
import { Skeleton, SkeletonGroup } from "@/app/components/ui/skeleton";
import { PrActions } from "@/app/features/pulls/components/PrActions";
import { PrHeader } from "@/app/features/pulls/components/PrHeader";
import { PrSidebar } from "@/app/features/pulls/components/PrSidebar";
import { PrSubTabs } from "@/app/features/pulls/components/PrSubTabs";
import { prDetailQueryOptions, useFullPr, usePrReviews } from "@/app/features/pulls/hooks";

export const Route = createFileRoute("/$owner/$repo/pull/$number")({
  parseParams: (raw) => ({ number: Number(raw.number) }),
  // GitHub's `/pull/:n/files` is our review view.
  beforeLoad: ({ location, params }) => {
    if (/\/files\/?$/.test(location.pathname))
      throw redirect({ to: "/$owner/$repo/pr/$number", params, replace: true });
  },
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
  const reviewsQuery = usePrReviews(owner, repo, number);
  const pr = prQuery.data;
  const reviews = reviewsQuery.data ?? [];

  // Show cached data immediately, even if refetching in background
  // Only show skeleton on initial load (no data yet)
  const isLoading = prQuery.isPending && !prQuery.data;

  if (!Number.isSafeInteger(number) || number <= 0 || (!isLoading && !pr)) {
    return (
      <Container className="py-10">
        <div className="flex flex-col items-center gap-2 text-center">
          <AlertCircle className="size-5 text-destructive" />
          <p className="text-sm text-muted-foreground">
            {prQuery.isError ? "Could not load this pull request." : "Pull request not found."}
          </p>
        </div>
      </Container>
    );
  }

  return (
    <>
      {/* Header */}
      <Container className="pt-5 sm:pt-6 pb-4">
        {pr ? (
          <PrHeader
            owner={owner}
            repo={repo}
            pr={pr}
            actionsSlot={<PrActions owner={owner} repo={repo} pr={pr} />}
          />
        ) : (
          <PrHeaderSkeleton />
        )}
      </Container>

      {/* Sticky tabs bar */}
      <div className="sticky top-0 z-10 border-b border-border bg-background">
        <Container>
          <PrSubTabs
            owner={owner}
            repo={repo}
            number={number}
            counts={{
              conversation: pr ? pr.comments + pr.review_comments : undefined,
              commits: pr?.commits,
              files: pr?.changed_files,
            }}
            changeStats={pr ? { additions: pr.additions, deletions: pr.deletions } : undefined}
          />
        </Container>
      </div>

      {/* Two-column layout with sticky sidebar */}
      <Container className="py-6">
        <div className="flex gap-6 lg:gap-8">
          {/* Main content */}
          <div className="min-w-0 flex-1">
            <Outlet />
          </div>

          {/* Sticky sidebar */}
          <aside className="hidden lg:block w-[328px] flex-shrink-0">
            <div className="sticky top-14">
              {pr ? (
                <PrSidebar owner={owner} repo={repo} pr={pr} reviews={reviews} />
              ) : (
                <MetadataSkeleton />
              )}
            </div>
          </aside>
        </div>
      </Container>
    </>
  );
}

function PrHeaderSkeleton() {
  return (
    <SkeletonGroup label="Loading pull request" className="skeleton-fade">
      <Skeleton className="mb-4 h-4 w-28" />
      <Skeleton className="mb-3 h-7 w-3/4" />
      <div className="mb-2 flex items-center gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-4 w-60" />
      </div>
      <Skeleton className="h-3 w-48" />
    </SkeletonGroup>
  );
}
