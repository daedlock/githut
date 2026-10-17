import { Link } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, GitCommit } from "lucide-react";
import type { ReactNode } from "react";
import { StatusIcon, StatusPill } from "@/app/components/ui/StatusPill";
import { formatDuration } from "@/app/components/ui/Timeline";
import { ProfileLink } from "@/app/components/user/ProfileLink";
import { formatRelativeTime } from "@/app/lib/time";
import { durationMs, statusLabel, toUiStatus } from "../lib/statusMap";
import { useNow } from "../lib/useNow";
import type { WorkflowRun } from "../schemas";
import { BranchRef } from "./BranchRef";
import { RunActions } from "./RunActions";

export function RunHeader({ owner, repo, run }: { owner: string; repo: string; run: WorkflowRun }) {
  const ui = toUiStatus(run.status, run.conclusion);
  return (
    <header>
      <Link
        to="/$owner/$repo/actions"
        params={{ owner, repo }}
        search={{ workflow: run.workflow_id }}
        className="mb-4 inline-flex items-center gap-2 rounded text-caption text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="size-3.5" />
        {run.name ?? "Workflow runs"}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <StatusIcon variant={ui.kind} size={5} className="mt-1 shrink-0" />
          <div className="min-w-0">
            <h1 className="break-words text-heading font-[475] tracking-tight">
              {run.display_title || run.name || "Workflow run"}{" "}
              <span className="text-muted-foreground">#{run.run_number}</span>
            </h1>
            <p className="mt-1 text-caption text-muted-foreground">
              {run.name} · Attempt {run.run_attempt} · {statusLabel(ui)}
            </p>
          </div>
        </div>
        <RunActions key={`${run.id}-${run.run_attempt}`} owner={owner} repo={repo} run={run} />
      </div>
    </header>
  );
}

export function RunOverview({ run, artifactCount }: { run: WorkflowRun; artifactCount?: number }) {
  const now = useNow();
  const ui = toUiStatus(run.status, run.conclusion);
  const elapsed = durationMs(
    run.run_started_at,
    run.status === "completed" ? run.updated_at : null,
    run.status === "in_progress",
    now,
  );
  const actor = run.triggering_actor ?? run.actor;
  return (
    <section
      aria-label="Run summary"
      className="grid grid-cols-2 gap-4 rounded-lg bg-muted p-4 @5xl/pane:grid-cols-[2fr_1fr_1fr_1fr]"
    >
      <Metric
        label={`${run.event === "workflow_dispatch" ? "Manually triggered" : run.event.replaceAll("_", " ")} ${formatRelativeTime(run.created_at)}`}
      >
        <div className="flex flex-wrap items-center gap-2 text-ui">
          {actor ? (
            <ProfileLink login={actor.login} className="font-medium">
              {actor.login}
            </ProfileLink>
          ) : (
            <span>Unknown actor</span>
          )}
          <a
            href={`https://github.com/${encodeURIComponent(run.html_url.split("/")[3] ?? "")}/${encodeURIComponent(run.html_url.split("/")[4] ?? "")}/commit/${run.head_sha}`}
            className="inline-flex items-center gap-1 text-caption text-muted-foreground hover:underline"
          >
            <GitCommit className="size-3" />
            {run.head_sha.slice(0, 7)}
          </a>
          {run.head_branch ? <BranchRef branch={run.head_branch} className="max-w-40" /> : null}
        </div>
      </Metric>
      <Metric label="Status">
        <StatusPill variant={ui.kind} label={statusLabel(ui)} size="md" ghost />
      </Metric>
      <Metric label="Duration">
        <span className="text-ui tabular-nums">
          {elapsed === null ? "—" : formatDuration(elapsed)}
        </span>
      </Metric>
      <Metric label="Artifacts">
        <span className="text-ui tabular-nums">{artifactCount ?? "—"}</span>
      </Metric>
    </section>
  );
}

function Metric({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="text-caption text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

export function WorkflowFileLink({
  owner,
  repo,
  run,
}: {
  owner: string;
  repo: string;
  run: WorkflowRun;
}) {
  return (
    <a
      href={`https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/blob/${run.head_sha}/${run.path.split("@")[0]}`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 px-3 py-2 text-caption text-muted-foreground hover:text-foreground"
    >
      <ExternalLink className="size-3.5" />
      Workflow file
    </a>
  );
}
