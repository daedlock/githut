import { Skeleton, SkeletonGroup } from "@/app/components/ui/skeleton";

/**
 * Detail-sidebar placeholder. Mirrors a stack of `PropertySection`s: flat on
 * the page, `gap-6`, an h-6 header over one value row.
 */
export function MetadataSkeleton({ sections = 4 }: { sections?: number }) {
  return (
    <SkeletonGroup label="Loading metadata" className="flex flex-col gap-6">
      {Array.from({ length: sections }, (_, section) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
        <div key={section} className="flex flex-col gap-2">
          <div className="flex h-6 items-center gap-1.5">
            <Skeleton className="size-3.5 shrink-0 rounded-full" />
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="flex h-5.5 items-center">
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
        </div>
      ))}
    </SkeletonGroup>
  );
}
