import { Link } from "@tanstack/react-router";
import { ArrowLeft, GitCommit } from "lucide-react";
import { StatusPill } from "@/app/components/ui/StatusPill";
import { formatDuration } from "@/app/components/ui/Timeline";
import { ProfileLink } from "@/app/components/user/ProfileLink";
import { BranchRef } from "@/app/features/actions/components/BranchRef";
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
    <section>
      <Link
        to="/$owner/$repo/actions"
        params={{ owner, repo }}
        className={cn(
          "-ml-1.5 mb-3 inline-flex items-center gap-1.5 rounded-sm px-1.5 py-1",
          "text-caption text-muted-foreground outline-none transition-colors",
          "hover:text-foreground focus-visible:ring-1 focus-visible:ring-foreground/15",
        )}
      >
        <ArrowLeft className="size-3" strokeWidth={2.25} />
        <span>All runs</span>
      </Link>

      <div className="flex items-start gap-2">
        <h1 className="text-heading font-[475] tracking-tight text-foreground">{commitTitle}</h1>
        <RunActions owner={owner} repo={repo} run={run} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-caption text-muted-foreground">
        <StatusPill variant={ui.kind} size="md" />
        <Sep />
        <span className="font-mono tabular-nums">#{run.run_number}</span>
        <Sep />
        <span className="font-mono">{run.name ?? "workflow"}</span>
        <Sep />
        <span>{run.event}</span>
        {run.head_branch ? (
          <>
            <Sep />
            <BranchRef branch={run.head_branch} className="max-w-56" />
          </>
        ) : null}
        <Sep />
        <span className="inline-flex items-center gap-1 font-mono tabular-nums">
          <GitCommit className="size-3 opacity-50" aria-hidden />
          {shortSha}
        </span>
        {actor ? (
          <>
            <Sep />
            <ProfileLink login={actor.login} className="font-medium text-foreground">
              {actor.login}
            </ProfileLink>
          </>
        ) : null}
        <Sep />
        <span>started {formatRelativeTime(startedAt)}</span>
        <Sep />
        <span className="font-mono tabular-nums">{formatDuration(durationMs)}</span>
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
