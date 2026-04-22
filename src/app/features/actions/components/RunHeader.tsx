import { Link } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, GitBranch, GitCommit } from "lucide-react";
import { StatusPill } from "@/app/components/ui/StatusPill";
import { formatDuration } from "@/app/components/ui/Timeline";
import { ProfileLink } from "@/app/components/user/ProfileLink";
import { RunActions } from "@/app/features/actions/components/RunActions";
import { toUiStatus } from "@/app/features/actions/lib/statusMap";
import { useNow } from "@/app/features/actions/lib/useNow";
import type { WorkflowRun } from "@/app/features/actions/schemas";
import { cn } from "@/app/lib/cn";
import { formatRelativeTime } from "@/app/lib/time";

export type RunHeaderProps = {
  owner: string;
  repo: string;
  run: WorkflowRun;
};

/**
 * Run detail header. Anchors the page with the commit title + status, then
 * folds the meta (workflow, event, branch, sha, actor, timing) into a
 * single dense row underneath. Matches the CommitDetailPage editorial feel
 * — full-bleed top strip, no Container wrap at this level.
 */
export function RunHeader({ owner, repo, run }: RunHeaderProps) {
  const now = useNow();
  const ui = toUiStatus(run.status, run.conclusion);
  const startedAt = run.run_started_at ?? run.created_at;
  const isTerminal = run.status === "completed";
  // Live runs sample `now` every second (via NowTicker) — the duration
  // advances even between 3s data polls, so the header reads as ticking.
  const durationMs = isTerminal
    ? new Date(run.updated_at).getTime() - new Date(startedAt).getTime()
    : now - new Date(startedAt).getTime();

  const commitTitle = firstLine(run.head_commit?.message ?? run.display_title);
  const shortSha = run.head_sha.slice(0, 7);
  const actor = run.actor ?? run.triggering_actor;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Link
          to="/$owner/$repo/actions"
          params={{ owner, repo }}
          className={cn(
            "inline-flex w-fit items-center gap-1 rounded-sm px-1 py-0.5 -ml-1",
            "font-sans text-caption text-(--color-fg-muted) outline-none",
            "hover:text-(--color-fg)",
            "focus-visible:ring-1 focus-visible:ring-(--color-focus)",
          )}
        >
          <ArrowLeft className="size-3" strokeWidth={2.25} />
          <span>All runs</span>
        </Link>

        <a
          href={run.html_url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "inline-flex items-center gap-1 rounded-sm px-1 py-0.5",
            "font-sans text-caption text-(--color-fg-muted) outline-none",
            "hover:text-(--color-fg)",
            "focus-visible:ring-1 focus-visible:ring-(--color-focus)",
          )}
          title="Open this run on github.com"
        >
          <span>View on GitHub</span>
          <ExternalLink className="size-3" strokeWidth={2.25} />
        </a>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex items-baseline gap-2 text-title font-medium leading-snug text-foreground">
            <span className="truncate">{commitTitle}</span>
            <span className="shrink-0 font-mono text-body text-(--color-fg-faint) tabular-nums">
              #{run.run_number}
            </span>
          </h1>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-muted-foreground">
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
                <ProfileLink login={actor.login} className="font-mono text-muted-foreground">
                  {actor.login}
                </ProfileLink>
              </>
            ) : null}
            <Sep />
            <span>started {formatRelativeTime(startedAt)}</span>
          </div>
        </div>

        {/* Status + duration + actions, top-right. StatusPill carries the
            live spinner (via pill variant) so no extra "running" indicator. */}
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <StatusPill variant={ui.kind} size="md" />
          <span
            className={cn(
              "font-mono text-caption tabular-nums",
              ui.kind === "running"
                ? "text-(--color-warning)"
                : ui.kind === "failure"
                  ? "text-(--color-danger)"
                  : "text-muted-foreground",
            )}
          >
            {formatDuration(durationMs)}
          </span>
          <RunActions owner={owner} repo={repo} run={run} />
        </div>
      </div>
    </section>
  );
}

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
