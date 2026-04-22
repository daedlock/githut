import { Link } from "@tanstack/react-router";
import { GitBranch, GitCommit } from "lucide-react";
import { StatusPill } from "@/app/components/ui/StatusPill";
import { ProfileLink } from "@/app/components/user/ProfileLink";
import { formatDuration } from "@/app/components/ui/Timeline";
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
 * One run in a list. Clicking the row navigates to the detail view — the
 * whole surface is a <Link> so TanStack Router's intent-preload warms the
 * detail route on hover, no manual wiring required.
 */
export function RunRow({ owner, repo, run }: RunRowProps) {
  const ui = toUiStatus(run.status, run.conclusion);
  const startedAt = run.run_started_at ?? run.created_at;
  const durationMs =
    run.status === "completed"
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
        "group flex items-start gap-3 border-b border-border px-4 py-3 last:border-b-0",
        "outline-none transition-colors",
        "hover:bg-(--color-bg-sunken) focus-visible:bg-(--color-bg-sunken)",
      )}
    >
      {/* Status column */}
      <div className="mt-0.5 flex-shrink-0">
        <StatusPill variant={ui.kind} size="sm" iconOnly />
      </div>

      {/* Main column */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="truncate text-body font-medium text-foreground">{commitTitle}</p>
          <span className="font-mono text-caption text-muted-foreground">
            #{run.run_number}
          </span>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-caption text-muted-foreground">
          <span className="font-mono text-(--color-fg-muted)">{run.name ?? "workflow"}</span>
          <span className="text-(--color-fg-faint)" aria-hidden>·</span>
          <span>{run.event}</span>
          {run.head_branch ? (
            <>
              <span className="text-(--color-fg-faint)" aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                <GitBranch className="size-3 text-(--color-fg-faint)" />
                <span className="font-mono">{run.head_branch}</span>
              </span>
            </>
          ) : null}
          <span className="text-(--color-fg-faint)" aria-hidden>·</span>
          <span className="inline-flex items-center gap-1">
            <GitCommit className="size-3 text-(--color-fg-faint)" />
            <span className="font-mono tabular-nums">{shortSha}</span>
          </span>
          {actor ? (
            <>
              <span className="text-(--color-fg-faint)" aria-hidden>·</span>
              <ProfileLink
                login={actor.login}
                stopPropagation
                className="font-medium text-muted-foreground"
              >
                {actor.login}
              </ProfileLink>
            </>
          ) : null}
        </div>
      </div>

      {/* Right meta */}
      <div className="flex flex-shrink-0 flex-col items-end gap-0.5 text-caption text-muted-foreground">
        <span className="font-mono tabular-nums">{formatDuration(durationMs)}</span>
        <span className="text-(--color-fg-faint)">{formatRelativeTime(startedAt)}</span>
      </div>
    </Link>
  );
}

function firstLine(s: string): string {
  const i = s.indexOf("\n");
  return (i === -1 ? s : s.slice(0, i)).trim();
}
