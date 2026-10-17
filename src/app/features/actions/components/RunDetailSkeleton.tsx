import { Skeleton, SkeletonGroup } from "@/app/components/ui/skeleton";

export function RunDetailSkeleton() {
  return (
    <SkeletonGroup label="Loading workflow run" className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-4 w-40" />
        <div className="flex items-center gap-3">
          <Skeleton className="size-6 shrink-0 rounded-full" />
          <Skeleton className="h-7 w-2/3" />
        </div>
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="flex flex-col items-start gap-6 @3xl/pane:flex-row @3xl/pane:gap-8">
        <div className="w-full shrink-0 space-y-5 @3xl/pane:w-60">
          <Skeleton className="h-10 w-full rounded-md" />
          <div className="hidden space-y-4 px-3 @3xl/pane:block">
            {[72, 56, 80, 64].map((width) => (
              <Skeleton key={width} className="h-4" style={{ width: `${width}%` }} />
            ))}
          </div>
        </div>
        <div className="w-full min-w-0 flex-1 space-y-5">
          <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted p-4 @xl/pane:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="min-w-0 space-y-3">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
          <div className="space-y-5 rounded-lg bg-muted p-4">
            <Skeleton className="h-4 w-32" />
            <div className="grid gap-4 @xl/pane:grid-cols-2">
              {[0, 1].map((job) => (
                <div key={job} className="space-y-3 rounded-md border border-border p-4">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          </div>
          <JobListSkeleton />
        </div>
      </div>
    </SkeletonGroup>
  );
}

export function JobListSkeleton() {
  return (
    <SkeletonGroup label="Loading jobs" className="space-y-1">
      {[72, 56, 64].map((width) => (
        <div key={width} className="flex items-center gap-3 px-3 py-3">
          <Skeleton className="size-4 shrink-0 rounded-full" />
          <Skeleton className="h-4" style={{ width: `${width}%` }} />
          <Skeleton className="ml-auto h-3 w-12" />
        </div>
      ))}
    </SkeletonGroup>
  );
}
