import { Skeleton, SkeletonGroup } from "@/app/components/ui/skeleton";

export function MetadataSkeleton() {
  return (
    <SkeletonGroup label="Loading metadata" className="space-y-6 rounded-lg bg-muted p-4">
      {[0, 1, 2, 3].map((section) => (
        <div key={section} className="space-y-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-5 w-3/5" />
        </div>
      ))}
    </SkeletonGroup>
  );
}
