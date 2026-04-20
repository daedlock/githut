import { Avatar } from "@/app/components/ui/avatar";
import type { IssueUser } from "@/app/features/issues/schemas";

/**
 * AssigneeList — two render modes:
 *   "stack"  → avatars only, overlapped (used in issue row on the right)
 *   "rows"   → avatar + login per row (used in the sidebar)
 *
 * `max` only applies to "stack" mode (list row needs a cap; sidebar shows all).
 */
export function AssigneeList({
  assignees,
  variant = "rows",
  max = 3,
}: {
  assignees: IssueUser[];
  variant?: "stack" | "rows";
  max?: number;
}) {
  if (assignees.length === 0) {
    if (variant === "stack") return null;
    return <span className="text-caption text-[var(--color-fg-faint)]">No one assigned</span>;
  }

  if (variant === "stack") {
    return (
      <div className="flex flex-shrink-0 -space-x-1.5">
        {assignees.slice(0, max).map((a) => (
          <Avatar key={a.login} login={a.login} avatarUrl={a.avatar_url} size="sm" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {assignees.map((a) => (
        <div key={a.login} className="flex items-center gap-2">
          <Avatar login={a.login} avatarUrl={a.avatar_url} size="sm" />
          <span className="text-caption text-muted-foreground">{a.login}</span>
        </div>
      ))}
    </div>
  );
}
