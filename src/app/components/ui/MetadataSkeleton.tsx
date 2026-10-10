import { Card } from "@/app/components/ui/card";
import { Skeleton, SkeletonGroup } from "@/app/components/ui/skeleton";

const SECTION_KEYS = ["first", "second", "third", "fourth", "fifth", "sixth"];

/**
 * Detail-sidebar placeholder. Mirrors the sidebar's cards: `gap-4` between
 * them, each a `PropertySection` (h-6 header over one value row) inside p-3.
 */
export function MetadataSkeleton({ sections = 4 }: { sections?: number }) {
  return (
    <SkeletonGroup label="Loading metadata" className="flex flex-col gap-4">
      {SECTION_KEYS.slice(0, sections).map((key) => (
        <Card key={key} variant="muted" className="flex flex-col gap-2 p-3">
          <div className="flex h-6 items-center gap-1.5">
            <Skeleton className="size-3.5 shrink-0 rounded-full" />
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="flex h-5.5 items-center">
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
        </Card>
      ))}
    </SkeletonGroup>
  );
}
