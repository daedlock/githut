import {
  CheckCircle2,
  CircleDot,
  GitMerge,
  GitPullRequestClosed,
  GitPullRequestDraft,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import {
  useMergePr,
  useSetPrDraft,
  useTogglePrState,
} from "@/app/features/pulls/hooks";
import { toUiState } from "@/app/features/pulls/lib/prStatus";
import type { PullRequest } from "@/app/features/pulls/schemas";
import { PrMergeDialog } from "@/app/features/pulls/components/PrMergeDialog";

// ─── PrActions ─────────────────────────────────────────────────────────────
//
// Right-side action cluster in the PR header. Surface depends on state:
//
//   open, not draft  → [Merge] [Close] [Convert to draft]
//   open, draft      → [Ready for review] [Close]
//   closed           → [Reopen]
//   merged           → (none — render nothing, merge is terminal)
//
// Every action is optimistic via the mutations in hooks.ts, so clicks
// feel instant. The Merge button opens a dialog for method selection.

export function PrActions({
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
  const setDraft = useSetPrDraft(owner, repo, pr.number);

  const [mergeOpen, setMergeOpen] = useState(false);

  if (state === "merged") return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {state === "open" && (
        <>
          <Button
            size="sm"
            variant="default"
            disabled={merge.isPending || pr.mergeable === false}
            onClick={() => setMergeOpen(true)}
            title={
              pr.mergeable === false
                ? "This pull request has conflicts and can't be merged"
                : undefined
            }
          >
            <GitMerge data-icon="inline-start" />
            Merge
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={setDraft.isPending}
            onClick={() =>
              setDraft.mutate({ draft: true, nodeId: pr.node_id })
            }
          >
            <GitPullRequestDraft data-icon="inline-start" />
            Convert to draft
          </Button>
        </>
      )}

      {state === "draft" && (
        <Button
          size="sm"
          variant="default"
          disabled={setDraft.isPending}
          onClick={() =>
            setDraft.mutate({ draft: false, nodeId: pr.node_id })
          }
        >
          <CheckCircle2 data-icon="inline-start" />
          Ready for review
        </Button>
      )}

      {(state === "open" || state === "draft") && (
        <Button
          size="sm"
          variant="outline"
          disabled={toggleState.isPending}
          onClick={() => toggleState.mutate({ state: "closed" })}
        >
          <GitPullRequestClosed data-icon="inline-start" />
          Close pull request
        </Button>
      )}

      {state === "closed" && (
        <Button
          size="sm"
          variant="default"
          disabled={toggleState.isPending}
          onClick={() => toggleState.mutate({ state: "open" })}
        >
          <CircleDot data-icon="inline-start" />
          Reopen pull request
        </Button>
      )}

      <PrMergeDialog
        open={mergeOpen}
        onOpenChange={setMergeOpen}
        pr={pr}
        isPending={merge.isPending}
        onConfirm={(vars) =>
          merge.mutate(vars, {
            onSuccess: () => setMergeOpen(false),
          })
        }
      />
    </div>
  );
}
