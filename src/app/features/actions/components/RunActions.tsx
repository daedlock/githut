import { useIsMutating } from "@tanstack/react-query";
import { Ban, ExternalLink, MoreHorizontal, RefreshCw, RotateCcw } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { useCanMutate } from "@/app/lib/connectivity";
import { useCancelRun, useRerunFailedJobs, useRerunRun } from "../hooks";
import { isFailure, isTerminal, toUiStatus } from "../lib/statusMap";
import type { WorkflowRun } from "../schemas";

export function RunActions({
  owner,
  repo,
  run,
}: {
  owner: string;
  repo: string;
  run: WorkflowRun;
}) {
  const { canMutate, reason } = useCanMutate();
  const ui = toUiStatus(run.status, run.conclusion);
  const live = !isTerminal(ui);
  const rerun = useRerunRun(owner, repo);
  const failed = useRerunFailedJobs(owner, repo);
  const cancel = useCancelRun(owner, repo);
  const pending =
    useIsMutating({
      mutationKey: ["actions-command", owner, repo],
      predicate: (mutation) => mutation.state.variables === run.id,
    }) > 0;
  const error = rerun.error ?? failed.error ?? cancel.error;
  const accepted = rerun.isSuccess || failed.isSuccess || cancel.isSuccess;
  return (
    <div className="flex max-w-sm flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={pending || !canMutate}
          title={reason}
          onClick={() => (live ? cancel.mutate(run.id) : rerun.mutate(run.id))}
        >
          {live ? <Ban /> : <RotateCcw />}
          {pending ? "Requesting…" : live ? "Cancel workflow" : "Re-run all jobs"}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="More run actions" disabled={pending}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!live && isFailure(ui) ? (
              <DropdownMenuItem disabled={!canMutate} onSelect={() => failed.mutate(run.id)}>
                <RefreshCw />
                Re-run failed jobs
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem asChild>
              <a href={run.html_url} target="_blank" rel="noreferrer">
                <ExternalLink />
                View on GitHub
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {error ? (
        <p role="alert" className="text-caption text-destructive">
          {error.message || "The request failed. Try again."}
        </p>
      ) : pending ? (
        <p role="status" className="text-caption text-muted-foreground">
          Waiting for GitHub to update the run…
        </p>
      ) : accepted ? (
        <p role="status" className="text-caption text-muted-foreground">
          Request accepted.
        </p>
      ) : null}
    </div>
  );
}
