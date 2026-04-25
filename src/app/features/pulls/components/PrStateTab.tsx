import { GitPullRequest, GitPullRequestClosed } from "lucide-react";
import type { PullsState } from "@/app/features/pulls/hooks";
import { cn } from "@/app/lib/cn";

// ─── PrStateTab ────────────────────────────────────────────────────────────
//
// Mirrors `issues/components/StateTab` exactly — same sizing, same text
// tokens, same count+label layout — so the PRs list header reads as a
// sibling of the Issues list header. Only differences: PR-specific icons
// (git-pull-request octicon family) and PR state semantics.

export function PrStateTab({
  state,
  count,
  isActive,
  onClick,
}: {
  state: PullsState;
  count: number | undefined;
  isActive: boolean;
  onClick: () => void;
}) {
  const Icon = state === "open" ? GitPullRequest : GitPullRequestClosed;
  const activeIconTone =
    state === "open" ? "text-[var(--color-success)]" : "text-muted-foreground";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1.5 text-caption rounded-md",
        "outline-none transition-colors",
        "focus-visible:ring-1 focus-visible:ring-foreground/15",
        isActive
          ? "font-semibold text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon
        className={cn(
          "size-4",
          isActive ? activeIconTone : "text-[var(--color-fg-faint)]",
        )}
      />
      {typeof count === "number" ? (
        <span className="tabular-nums">{count}</span>
      ) : null}
      <span className="capitalize">{state === "open" ? "Open" : "Closed"}</span>
    </button>
  );
}
