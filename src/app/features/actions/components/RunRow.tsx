import { Link } from "@tanstack/react-router";
import { GitBranch, GitCommit } from "lucide-react";
import { StatusIcon } from "@/app/components/ui/StatusPill";
import { formatDuration } from "@/app/components/ui/Timeline";
import { ProfileLink } from "@/app/components/user/ProfileLink";
import { toUiStatus } from "@/app/features/actions/lib/statusMap";
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
  const isTerminal = run.status === "completed";
  const durationMs = isTerminal
    ? new Date(run.updated_at).getTime() - new Date(startedAt).getTime()
    : Date.now() - new Date(startedAt).getTime();

  const commitTitle = firstLine(run.head_commit?.message ?? run.display_title);
  const shortSha = run.head_sha.slice(0, 7);
  const actor = run.actor ?? run.triggering_actor;

  return (
    <Link
      to="/$owner/$repo/actions/runs/$runId"
      params={{ owner, repo, runId: String(run.id) }}
      className={cn(
        "group flex items-start gap-3 border-b border-border px-4 py-2.5 last:border-b-0",
        "outline-none hover:bg-(--color-bg-sunken) focus-visible:bg-(--color-bg-sunken)",
      )}
    >
      <StatusIcon variant={ui.kind} size={4} className="mt-0.5 shrink-0" />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="truncate text-body font-medium text-foreground">{commitTitle}</p>
          <span className="font-mono text-caption tabular-nums text-(--color-fg-faint)">
            #{run.run_number}
          </span>
        </div>

        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-caption text-muted-foreground">
          <span className="font-mono">{run.name ?? "workflow"}</span>
          <Sep />
          <span className="font-sans">{run.event}</span>
          {run.head_branch ? (
            <>
              <Sep />
              <span className="inline-flex items-center gap-1">
                <GitBranch className="size-3 text-(--color-fg-faint)" aria-hidden />
                <span className="font-mono">{run.head_branch}</span>
              </span>
            </>
          ) : null}
          <Sep />
          <span className="inline-flex items-center gap-1">
            <GitCommit className="size-3 text-(--color-fg-faint)" aria-hidden />
            <span className="font-mono tabular-nums">{shortSha}</span>
          </span>
          {actor ? (
            <>
              <Sep />
              <ProfileLink
                login={actor.login}
                stopPropagation
                className="font-mono text-muted-foreground"
              >
                {actor.login}
              </ProfileLink>
            </>
          ) : null}
        </div>
      </div>

      <div className="flex flex-shrink-0 flex-col items-end gap-0.5 text-caption">
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
          {formatDuration(durationMs)}
        </span>
        <span className="font-sans text-(--color-fg-faint)">
          {formatRelativeTime(startedAt)}
        </span>
      </div>
    </Link>
  );
}

// Hairline dot separator — consistent with CommitRow/IssueRow meta rows.
function Sep() {
  return (
    <span className="text-(--color-fg-faint)" aria-hidden>
      ·
    </span>
  );
}

function firstLine(s: string): string {
  const i = s.indexOf("\n");
  return (i === -1 ? s : s.slice(0, i)).trim();
}
