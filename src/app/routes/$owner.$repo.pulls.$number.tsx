import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
import { Container } from "@/app/components/ui/Container";
import { Skeleton } from "@/app/components/ui/skeleton";
import { PrActions } from "@/app/features/pulls/components/PrActions";
import { PrHeader } from "@/app/features/pulls/components/PrHeader";
import { PrSidebar } from "@/app/features/pulls/components/PrSidebar";
import { PrSubTabs } from "@/app/features/pulls/components/PrSubTabs";
import {
  prDetailQueryOptions,
  useFullPr,
  usePrReviews,
} from "@/app/features/pulls/hooks";

export const Route = createFileRoute("/$owner/$repo/pulls/$number")({
  parseParams: (raw) => ({ number: Number(raw.number) }),
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
      <PrHeader
        owner={owner}
        repo={repo}
        pr={pr}
        rightSlot={<PrActions owner={owner} repo={repo} pr={pr} />}
      />
      <div className="pt-4"/>
      <PrSubTabs
        owner={owner}
        repo={repo}
        number={number}
        counts={{
          conversation: pr.comments + pr.review_comments,
          commits: pr.commits,
          files: pr.changed_files,
        }}
        deltas={{ additions: pr.additions, deletions: pr.deletions }}
      />

      {/* Two-column layout with sticky sidebar */}
      <div className="mt-6 flex gap-6 lg:gap-8">
        {/* Main content */}
        <div className="min-w-0 flex-1">
          <Outlet />
        </div>

        {/* Sticky sidebar */}
        <aside className="hidden lg:block w-[328px] flex-shrink-0">
          <div className="sticky top-20">
            <PrSidebar owner={owner} repo={repo} pr={pr} reviews={reviews} />
          </div>
        </aside>
      </div>
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
    </div>
  );
}
