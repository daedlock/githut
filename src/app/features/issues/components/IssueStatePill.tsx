import { CheckCircle2, CircleDot, CircleSlash } from "lucide-react";
import { cn } from "@/app/lib/cn";

/**
 * Issue state in a detail header. Same geometry as `PrStatePill` (sm): open
 * takes the success tint; closed is neutral, never a status color.
 */
export function IssueStatePill({
  state,
  stateReason,
  className,
}: {
  state: "open" | "closed";
  stateReason?: string | null;
  className?: string;
}) {
  const open = state === "open";
  const Icon = open ? CircleDot : stateReason === "not_planned" ? CircleSlash : CheckCircle2;
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 select-none items-center gap-1 rounded-full px-1.5 font-medium",
        open
          ? "bg-(--color-issue-open-bg) text-(--color-issue-open-fg)"
          : "bg-accent text-muted-foreground",
        className,
      )}
    >
      <Icon aria-hidden className={cn("size-3 shrink-0", !open && "text-(--color-fg-faint)")} />
      <span className="whitespace-nowrap text-caption">{open ? "Open" : "Closed"}</span>
    </span>
  );
}
