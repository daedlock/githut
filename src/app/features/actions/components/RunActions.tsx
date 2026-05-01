import { Ban, MoreHorizontal, RefreshCw, RotateCcw } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { useCancelRun, useRerunFailedJobs, useRerunRun } from "@/app/features/actions/hooks";
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Run actions">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        {live ? (
          <DropdownMenuItem
            variant="destructive"
            disabled={cancel.isPending}
            onSelect={() => cancel.mutate(run.id)}
          >
            <Ban />
            <span className="whitespace-nowrap">
              {cancel.isPending ? "Cancelling…" : "Cancel run"}
            </span>
          </DropdownMenuItem>
        ) : (
          <>
            {hasFailure ? (
              <DropdownMenuItem
                disabled={rerunFailed.isPending || rerun.isPending}
                onSelect={() => rerunFailed.mutate(run.id)}
              >
                <RefreshCw className="text-muted-foreground" />
                <span className="whitespace-nowrap">
                  {rerunFailed.isPending ? "Rerunning…" : "Rerun failed jobs"}
                </span>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem
              disabled={rerun.isPending || rerunFailed.isPending}
              onSelect={() => rerun.mutate(run.id)}
            >
              <RotateCcw className="text-muted-foreground" />
              <span className="whitespace-nowrap">
                {rerun.isPending ? "Rerunning…" : "Rerun all jobs"}
              </span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
