import { Link } from "@tanstack/react-router";
import { GitCommit } from "lucide-react";
import { StatusIcon } from "@/app/components/ui/StatusPill";
import { formatDuration } from "@/app/components/ui/Timeline";
import { ProfileLink } from "@/app/components/user/ProfileLink";
import { BranchRef } from "@/app/features/actions/components/BranchRef";
import { durationMs, statusLabel, toUiStatus } from "@/app/features/actions/lib/statusMap";
import type { WorkflowRun } from "@/app/features/actions/schemas";
import { cn } from "@/app/lib/cn";
import { formatRelativeTime } from "@/app/lib/time";

export type RunRowProps = {
  owner: string;
  repo: string;
  run: WorkflowRun;
};

/**
 * One run. Follows the IssueRow / CommitRow rhythm: two lines (title + meta),
 * status icon on the left, durations right-aligned. No `transition-colors`
 * — dense lists respond instantly (DESIGN.md §Interactive State Machine).
 */
export function RunRow({ owner, repo, run }: RunRowProps) {
  const ui = toUiStatus(run.status, run.conclusion);
  const startedAt = run.run_started_at ?? run.created_at;
  const elapsed = durationMs(
    run.run_started_at,
    run.status === "completed" ? run.updated_at : null,
    run.status === "in_progress",
  );

  const commitTitle = firstLine(
    run.display_title || run.head_commit?.message || run.name || "Workflow run",
  );
  const shortSha = run.head_sha.slice(0, 7);
  const actor = run.triggering_actor ?? run.actor;

  return (
    <div className="group relative rounded-lg transition-colors hover:bg-muted">
      <div className="flex w-full items-start gap-3 px-4 py-2.5 text-left">
        <div className="mt-0.5 shrink-0">
          <StatusIcon variant={ui.kind} size={4} />
        </div>

        <div className="min-w-0 flex-1">
          <Link
            to="/$owner/$repo/actions/runs/$runId"
            params={{ owner, repo, runId: String(run.id) }}
            aria-label={`Open workflow run #${run.run_number}: ${commitTitle}`}
            data-keyboard-list-item
            className={cn(
              "flex min-w-0 items-baseline gap-2 rounded-sm outline-none",
              "after:absolute after:inset-0 after:z-10 after:rounded-lg after:content-['']",
              "focus-visible:after:ring-1 focus-visible:after:ring-foreground/20",
            )}
          >
            <span className="min-w-0 truncate text-body font-[475] text-foreground">
              {commitTitle}
            </span>
            <span className="shrink-0 font-mono text-caption tabular-nums text-(--color-fg-faint)">
              #{run.run_number}
            </span>
          </Link>

          <div className="mt-0.5 flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap text-ui text-muted-foreground">
            <span className="min-w-0 truncate">
              <span>{run.name ?? "workflow"}</span>
              <Sep />
              <span>{run.event}</span>
              <Sep />
              <span>{formatRelativeTime(startedAt)}</span>
              {actor ? (
                <>
                  <span> by </span>
                  <ProfileLink login={actor.login} className="relative z-20 text-muted-foreground">
                    {actor.login}
                  </ProfileLink>
                </>
              ) : null}
            </span>

            {run.head_branch ? (
              <>
                <Sep />
                <BranchRef branch={run.head_branch} className="relative z-20 max-w-44 shrink-0" />
              </>
            ) : null}

            <Sep />
            <span className="inline-flex shrink-0 items-center gap-1 font-mono tabular-nums">
              <GitCommit className="size-3 text-(--color-fg-faint)" aria-hidden />
              {shortSha}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-0.5 text-caption">
          <span
            className={cn(
              "font-mono tabular-nums",
              ui.kind === "running"
                ? "text-(--color-warning)"
                : ui.kind === "failure"
                  ? "text-(--color-danger)"
                  : "text-muted-foreground",
            )}
          >
            {elapsed === null ? "—" : formatDuration(elapsed)}
          </span>
          <span className="text-caption text-muted-foreground">{statusLabel(ui)}</span>
        </div>
      </div>
    </div>
  );
}

function Sep() {
  return (
    <span className="mx-1 text-(--color-fg-faint)" aria-hidden>
      ·
    </span>
  );
}

function firstLine(s: string): string {
  const i = s.indexOf("\n");
  return (i === -1 ? s : s.slice(0, i)).trim();
}
