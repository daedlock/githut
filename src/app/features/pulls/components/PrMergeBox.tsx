import {
  AlertCircle,
  CheckCircle2,
  GitMerge,
  GitPullRequestClosed,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { useMergePr, useTogglePrState } from "@/app/features/pulls/hooks";
import { toUiState } from "@/app/features/pulls/lib/prStatus";
import type { PullRequest } from "@/app/features/pulls/schemas";
import { PrMergeDialog } from "@/app/features/pulls/components/PrMergeDialog";
import { cn } from "@/app/lib/cn";

// ─── PrMergeBox ────────────────────────────────────────────────────────────
//
// Card at the bottom of the Conversation tab showing merge readiness +
// action buttons. Mirrors GitHub's own "merge box":
//   ✓ All checks passed → green, merge button
//   ⚠ Conflicts / not mergeable → yellow/red, explanation
//   ✗ Closed or merged → status-only

export function PrMergeBox({
  owner,
  repo,
  pr,
}: {
  owner: string;
  repo: string;
  pr: PullRequest;
}) {
  const state = toUiState(pr);
  const merge = useMergePr(owner, repo, pr.number);
  const toggleState = useTogglePrState(owner, repo, pr.number);
  const [mergeOpen, setMergeOpen] = useState(false);

  if (state === "merged") {
    return (
      <MergeBoxShell tone="merged">
        <GitMerge className="size-5 text-[var(--color-pr-merged)]" />
        <div>
          <p className="text-body font-medium text-foreground">
            Pull request successfully merged and closed.
          </p>
          {pr.merged_by && (
            <p className="text-caption text-muted-foreground">
              Merged by {pr.merged_by.login}
            </p>
          )}
        </div>
      </MergeBoxShell>
    );
  }

  if (state === "closed") {
    return (
      <MergeBoxShell tone="closed">
        <GitPullRequestClosed className="size-5 text-[var(--color-danger)]" />
        <div className="flex-1">
          <p className="text-body font-medium text-foreground">
            This pull request is closed.
          </p>
        </div>
        <Button
          size="sm"
          disabled={toggleState.isPending}
          onClick={() => toggleState.mutate({ state: "open" })}
        >
          Reopen pull request
        </Button>
      </MergeBoxShell>
    );
  }

  // Open or draft
  const mergeable = pr.mergeable;
  const hasConflicts = pr.mergeable_state === "dirty" || mergeable === false;

  return (
    <MergeBoxShell tone={hasConflicts ? "conflict" : "ready"}>
      {hasConflicts ? (
        <XCircle className="size-5 text-[var(--color-danger)]" />
      ) : mergeable === null ? (
        <AlertCircle className="size-5 text-[var(--color-warning)]" />
      ) : (
        <CheckCircle2 className="size-5 text-[var(--color-success)]" />
      )}
      <div className="flex-1">
        <p className="text-body font-medium text-foreground">
          {hasConflicts
            ? "This branch has conflicts that must be resolved."
            : mergeable === null
              ? "Mergeability is being computed…"
              : state === "draft"
                ? "This pull request is still a draft."
                : "This branch has no conflicts with the base branch."}
        </p>
        {!hasConflicts && mergeable && state !== "draft" && (
          <p className="text-caption text-muted-foreground">
            Merging can be performed automatically.
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {state !== "draft" && !hasConflicts && mergeable && (
          <Button
            size="sm"
            disabled={merge.isPending}
            onClick={() => setMergeOpen(true)}
          >
            <GitMerge data-icon="inline-start" />
            Merge pull request
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          disabled={toggleState.isPending}
          onClick={() => toggleState.mutate({ state: "closed" })}
        >
          Close pull request
        </Button>
      </div>
      <PrMergeDialog
        open={mergeOpen}
        onOpenChange={setMergeOpen}
        pr={pr}
        isPending={merge.isPending}
        onConfirm={(vars) =>
          merge.mutate(vars, { onSuccess: () => setMergeOpen(false) })
        }
      />
    </MergeBoxShell>
  );
}

function MergeBoxShell({
  tone,
  children,
}: {
  tone: "ready" | "conflict" | "merged" | "closed";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-md border px-4 py-3",
        tone === "ready" &&
          "border-[var(--color-success)]/30 bg-[color-mix(in_oklab,var(--color-success)_6%,var(--color-bg))]",
        tone === "conflict" &&
          "border-[var(--color-danger)]/30 bg-[color-mix(in_oklab,var(--color-danger)_6%,var(--color-bg))]",
        tone === "merged" &&
          "border-[var(--color-pr-merged)]/30 bg-[color-mix(in_oklab,var(--color-pr-merged)_6%,var(--color-bg))]",
        tone === "closed" &&
          "border-border bg-[var(--color-bg-subtle)]",
      )}
    >
      {children}
    </div>
  );
}
