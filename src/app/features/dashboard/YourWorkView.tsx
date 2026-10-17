import { CheckCircle2 } from "lucide-react";
import { LiveUpdates } from "@/app/components/LiveUpdates";
import { Container } from "@/app/components/ui/Container";
import { Skeleton, SkeletonGroup } from "@/app/components/ui/skeleton";
import { DashRow } from "@/app/features/dashboard/components/DashRow";
import {
  type DashboardItem,
  useMyOpenPrs,
  useReviewRequestedPrs,
} from "@/app/features/dashboard/hooks";
import { useListNavigation } from "@/app/hooks/useListNavigation";

// ─── Your work ─────────────────────────────────────────────────────────────
//
// Pull requests that need you (GLOSSARY): review requests first, oldest
// waiting on top, then your own open PRs. One flat list; navigation lives in
// the workspace sidebar, so there's no second one in here.

export function YourWorkView() {
  const review = useReviewRequestedPrs();
  const mine = useMyOpenPrs();
  const reviewIds = new Set(review.data?.map((item) => item.id));
  const sections = [
    { key: "review", title: "Review requested", items: review.data ?? [] },
    {
      key: "mine",
      title: "Your open pull requests",
      items: (mine.data ?? []).filter((item) => !reviewIds.has(item.id)),
    },
  ].filter((section) => section.items.length);
  const isPending = review.isPending || mine.isPending;
  const isError = review.isError || mine.isError;
  useListNavigation(!isPending && !isError);

  return (
    <Container className="pt-6">
      <h1 className="mb-5 text-heading font-semibold">Your work</h1>
      {isPending ? (
        <SkeletonGroup label="Loading your work" className="flex flex-col gap-5">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="flex gap-3 px-4">
              <Skeleton className="size-4 rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="h-3 w-2/5" />
              </div>
            </div>
          ))}
        </SkeletonGroup>
      ) : isError ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <span className="text-ui text-destructive">Couldn't load your work.</span>
          <span className="text-caption text-muted-foreground">
            GitHub may be slow or your sign-in may have expired.
          </span>
        </div>
      ) : !sections.length ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <CheckCircle2 className="size-8 text-muted-foreground" />
          <h2 className="text-heading font-medium">Nothing needs you</h2>
          <p className="max-w-sm text-ui text-muted-foreground">
            Review requests and your open pull requests will appear here.
          </p>
        </div>
      ) : (
        <LiveUpdates ready announce={false}>
          <div className="flex flex-col gap-7">
            {sections.map((section) => (
              <WorkSection key={section.key} title={section.title} items={section.items} />
            ))}
          </div>
        </LiveUpdates>
      )}
    </Container>
  );
}

function WorkSection({ title, items }: { title: string; items: DashboardItem[] }) {
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <div className="flex h-8 items-center gap-2 px-4">
        <h2 className="text-ui font-medium text-foreground">{title}</h2>
        <span className="font-mono text-caption tabular-nums text-muted-foreground">
          {items.length}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {items.map((item) => (
          <DashRow key={item.id} item={item} date={item.updated_at} showReason={false} />
        ))}
      </div>
    </section>
  );
}
