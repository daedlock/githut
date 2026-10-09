import { Skeleton, SkeletonGroup } from "@/app/components/ui/skeleton";

export function IssueListSkeleton() {
  const widths = [70, 56, 80, 46, 66, 74, 60];
  return (
    <SkeletonGroup label="Loading issues" className="skeleton-fade">
      {widths.map((w) => (
        <div key={w} className="flex items-start gap-3 py-3 pr-4 pl-10">
          <Skeleton className="size-4 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5" style={{ width: `${w}%` }} />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </SkeletonGroup>
  );
}
