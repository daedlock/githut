import { Skeleton, SkeletonGroup } from "@/app/components/ui/skeleton";

/** A comment-shaped placeholder shared by issue and pull request conversations. */
export function CommentSkeleton({ label = "Loading comment" }: { label?: string }) {
  return (
    <SkeletonGroup label={label} className="rounded-lg bg-muted p-4">
      <div className="mb-4 flex items-center gap-2">
        <Skeleton className="size-6 shrink-0 rounded-full" />
        <Skeleton className="h-3 w-32" />
        <Skeleton className="ml-auto h-3 w-16" />
      </div>
      <div className="space-y-2.5">
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/5" />
      </div>
    </SkeletonGroup>
  );
}
