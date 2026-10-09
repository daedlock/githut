import { ISSUE_STATE, issueVisualState } from "@/app/features/issues/issueState";
import { cn } from "@/app/lib/cn";

/** Issue state in a detail header. Same geometry as `PrStatePill` (sm). */
export function IssueStatePill({
  state,
  stateReason,
  className,
}: {
  state: "open" | "closed";
  stateReason?: string | null;
  className?: string;
}) {
  const visual = ISSUE_STATE[issueVisualState(state, stateReason)];
  const Icon = visual.icon;
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 select-none items-center gap-1 rounded-full px-1.5 font-medium",
        visual.pillClassName,
        className,
      )}
    >
      <Icon aria-hidden className="size-3 shrink-0" />
      <span className="whitespace-nowrap text-caption">{visual.label}</span>
    </span>
  );
}
