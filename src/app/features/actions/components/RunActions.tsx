import { Ban, RefreshCw, RotateCcw } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import {
  useCancelRun,
  useRerunFailedJobs,
  useRerunRun,
} from "@/app/features/actions/hooks";
import { isTerminal, toUiStatus } from "@/app/features/actions/lib/statusMap";
import type { WorkflowRun } from "@/app/features/actions/schemas";

export type RunActionsProps = {
  owner: string;
  repo: string;
  run: WorkflowRun;
};

// ─── RunActions ────────────────────────────────────────────────────────────
//
// Three actions, state-gated:
//   live  → [ Cancel ]
//   done  → [ Rerun failed ] (only if any failure)  [ Rerun all ]
//
// All use optimistic flips wired in hooks.ts: Rerun instantly flips the
// cached run to `queued` + increments `run_attempt`, so polling picks up
// from there. Cancel intentionally does NOT flip — GitHub has no
// "cancelling" state and an optimistic terminal flip would stop our 3 s
// polling before the real cancellation propagates.

export function RunActions({ owner, repo, run }: RunActionsProps) {
  const ui = toUiStatus(run.status, run.conclusion);
  const live = !isTerminal(ui);
  const hasFailure = ui.kind === "failure";

  const rerun = useRerunRun(owner, repo);
  const rerunFailed = useRerunFailedJobs(owner, repo);
  const cancel = useCancelRun(owner, repo);

  if (live) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => cancel.mutate(run.id)}
        disabled={cancel.isPending}
        className="text-(--color-danger) border-(--color-danger)/30 hover:bg-(--color-danger)/10 hover:text-(--color-danger)"
      >
        <Ban data-icon="inline-start" />
        {cancel.isPending ? "Cancelling…" : "Cancel"}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {hasFailure ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => rerunFailed.mutate(run.id)}
          disabled={rerunFailed.isPending || rerun.isPending}
        >
          <RefreshCw data-icon="inline-start" />
          {rerunFailed.isPending ? "Rerunning…" : "Rerun failed"}
        </Button>
      ) : null}
      <Button
        variant="default"
        size="sm"
        onClick={() => rerun.mutate(run.id)}
        disabled={rerun.isPending || rerunFailed.isPending}
      >
        <RotateCcw data-icon="inline-start" />
        {rerun.isPending ? "Rerunning…" : "Rerun"}
      </Button>
    </div>
  );
}
