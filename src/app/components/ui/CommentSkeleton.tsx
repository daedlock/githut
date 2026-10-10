import { Card } from "@/app/components/ui/card";
import { Skeleton, SkeletonGroup } from "@/app/components/ui/skeleton";

/**
 * A comment-block placeholder shared by issue and pull request conversations.
 * Mirrors `CommentCardDisplay`: an h-10 header, text-body line boxes, then the
 * reactions row.
 */
export function CommentSkeleton({ label = "Loading comment" }: { label?: string }) {
  return (
    <SkeletonGroup label={label}>
      <Card variant="muted">
        <div className="flex h-10 items-center gap-2 border-b border-border/50 px-4">
          <Skeleton className="size-5 shrink-0 rounded-full" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-28" />
        </div>
        <div className="flex flex-col p-4">
          {["80%", "100%", "60%"].map((width) => (
            <div key={width} className="flex h-5.5 items-center">
              <Skeleton className="h-3.5" style={{ width }} />
            </div>
          ))}
          <Skeleton className="mt-3 size-6 rounded-full" />
        </div>
      </Card>
    </SkeletonGroup>
  );
}
