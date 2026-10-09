import { CheckCircle2, CircleDot, CircleSlash, type LucideIcon } from "lucide-react";
import { cn } from "@/app/lib/cn";

// ─── Issue state visuals ───────────────────────────────────────────────────
//
// One source of truth for how an issue's state looks everywhere (rows,
// pills, tabs, group headers, pickers, hover cards, mentions). Purple means
// finished, as it does for merged pull requests; "not planned" is neutral.

export type IssueVisualState = "open" | "completed" | "not_planned";

export function issueVisualState(
  state: "open" | "closed",
  reason?: string | null,
): IssueVisualState {
  if (state === "open") return "open";
  return reason === "not_planned" || reason === "duplicate" ? "not_planned" : "completed";
}

export const ISSUE_STATE: Record<
  IssueVisualState,
  { icon: LucideIcon; label: string; iconClassName: string; pillClassName: string }
> = {
  open: {
    icon: CircleDot,
    label: "Open",
    iconClassName: "text-(--color-success)",
    pillClassName: "bg-(--color-issue-open-bg) text-(--color-issue-open-fg)",
  },
  completed: {
    icon: CheckCircle2,
    label: "Closed",
    iconClassName: "text-(--color-pr-merged)",
    pillClassName: "bg-(--color-issue-closed-bg) text-(--color-issue-closed-fg)",
  },
  not_planned: {
    icon: CircleSlash,
    label: "Not planned",
    iconClassName: "text-(--color-fg-faint)",
    pillClassName: "bg-accent text-muted-foreground",
  },
};

export function IssueStateIcon({
  state,
  reason,
  className,
}: {
  state: "open" | "closed";
  reason?: string | null;
  className?: string;
}) {
  const visual = ISSUE_STATE[issueVisualState(state, reason)];
  const Icon = visual.icon;
  return (
    <Icon
      aria-label={visual.label}
      className={cn("size-4 shrink-0", visual.iconClassName, className)}
    />
  );
}
