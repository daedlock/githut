import { Loader2 } from "lucide-react";
import { Button } from "@/app/components/ui/button";

/** Full-width "Load more" row at the end of a paginated list. */
export function LoadMoreButton({
  isFetching,
  onClick,
  label = "Load more",
}: {
  isFetching: boolean;
  onClick: () => void;
  label?: string;
}) {
  return (
    <Button
      variant="ghost"
      className="h-10 w-full text-caption"
      disabled={isFetching}
      aria-busy={isFetching}
      onClick={onClick}
    >
      {/* Keep the footprint while loading: spinner in place of the label. */}
      {isFetching ? <Loader2 aria-label="Loading" className="motion-safe:animate-spin" /> : label}
    </Button>
  );
}
