import { Container } from "@/app/components/ui/Container";
import { Skeleton, SkeletonGroup } from "@/app/components/ui/skeleton";

/** Keep the same container, toolbar, file tree, and gutters as DiffLayout. */
export function DiffLayoutSkeleton({
  sidebar = true,
  review = false,
}: {
  sidebar?: boolean;
  review?: boolean;
}) {
  return (
    <Container>
      <SkeletonGroup label="Loading changed files">
        <div className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border py-2">
          {review ? (
            <>
              <Skeleton className="h-6 min-w-0 basis-56 flex-1" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-5 w-14" />
              <Skeleton className="h-7 w-36" />
              <Skeleton className="ml-auto h-6 w-56" />
            </>
          ) : (
            <>
              <Skeleton className="h-4 w-36" />
              <Skeleton className="ml-auto h-7 w-36" />
            </>
          )}
        </div>
        <div className="flex w-full">
          {sidebar && (
            <div className="hidden w-[320px] shrink-0 space-y-4 p-4 @4xl/pane:block">
              <Skeleton className="h-7 w-full" />
              {[72, 88, 60, 80, 68].map((width) => (
                <Skeleton key={width} className="h-3.5" style={{ width: `${width}%` }} />
              ))}
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-5 p-4">
            {[0, 1].map((file) => (
              <div key={file} className="overflow-hidden rounded-md border border-border">
                <div className="flex h-10 items-center gap-3 border-b border-border bg-muted px-3">
                  <Skeleton className="size-4 shrink-0" />
                  <Skeleton className="h-3.5 w-64" />
                </div>
                <div className="space-y-2 p-4">
                  {[72, 56, 84, 48, 64, 76].map((width) => (
                    <div key={width} className="flex gap-4">
                      <Skeleton className="h-3 w-6 shrink-0" />
                      <Skeleton className="h-3" style={{ width: `${width}%` }} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </SkeletonGroup>
    </Container>
  );
}
