import { Skeleton, SkeletonGroup } from "@/app/components/ui/skeleton";

/**
 * Mirrors IssueRow: `py-2.5` with the checkbox gutter, a 16px state icon at
 * `mt-0.5`, a text-body title line box and a text-ui meta line box.
 */
export function IssueListSkeleton() {
  const widths = [70, 56, 80, 46, 66, 74, 60];
  return (
    <SkeletonGroup label="Loading issues" className="skeleton-fade flex flex-col gap-1">
      {widths.map((w) => (
        <div key={w} className="flex items-start gap-3 py-2.5 pr-4 pl-10">
          <Skeleton className="mt-0.5 size-4 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex h-5.5 items-center">
              <Skeleton className="h-3.5" style={{ width: `${w}%` }} />
            </div>
            <div className="mt-0.5 flex h-4.5 items-center">
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        </div>
      ))}
    </SkeletonGroup>
  );
}
