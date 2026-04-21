import { Skeleton } from "@/app/components/ui/skeleton";

export function IssueListSkeleton() {
  return (
    <>
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="flex items-start gap-3 px-4 py-3.5 sm:px-5"
          style={{ opacity: 1 - i * 0.12 }}
        >
          <Skeleton className="mt-0.5 size-4 flex-shrink-0 rounded-full" />
          <div className="flex-1 flex flex-col gap-1.5">
            <Skeleton className="h-4" style={{ width: `${55 + ((i * 13) % 35)}%` }} />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      ))}
    </>
  );
}
