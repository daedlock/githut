import {
  CheckCircle2,
  ChevronRight,
  Circle,
  CircleDot,
  Clock,
  ExternalLink,
  GitMerge,
  GitPullRequestClosed,
  Loader2,
  MinusCircle,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import {
  useMergePr,
  usePrChecks,
  useTogglePrState,
  type CheckRun,
  type PrChecksData,
} from "@/app/features/pulls/hooks";
import { toUiState } from "@/app/features/pulls/lib/prStatus";
import type { PullRequest } from "@/app/features/pulls/schemas";
import { PrMergeDialog } from "@/app/features/pulls/components/PrMergeDialog";
import { cn } from "@/app/lib/cn";
import { formatRelativeTime } from "@/app/lib/time";

export function PrMergeBox({
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
  const checksQuery = usePrChecks(owner, repo, pr.head.sha);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [checksExpanded, setChecksExpanded] = useState(false);

  // Terminal states
  if (state === "merged") {
    return (
      <div className="rounded-lg bg-[color-mix(in_oklab,var(--color-pr-merged)_12%,var(--color-bg-subtle))] p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-pr-merged)]">
            <GitMerge className="size-4 text-white" />
          </div>
          <div>
            <p className="text-ui font-medium text-foreground">Merged and closed</p>
            {pr.merged_by && (
              <p className="mt-0.5 text-caption text-muted-foreground">by {pr.merged_by.login}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (state === "closed") {
    return (
      <div className="rounded-lg bg-muted p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-danger)]">
            <GitPullRequestClosed className="size-4 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-ui font-medium text-foreground">Closed</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={toggleState.isPending}
            onClick={() => toggleState.mutate({ state: "open" })}
          >
            Reopen
          </Button>
        </div>
      </div>
    );
  }

  // Open / draft
  const mergeable = pr.mergeable;
  const hasConflicts = pr.mergeable_state === "dirty" || mergeable === false;
  const data = checksQuery.data;
  const summary = data ? summarizeChecks(data) : null;

  return (
    <div className="rounded-lg bg-muted overflow-hidden">
      {/* Checks section */}
      <div className="border-b border-border/50">
        <button
          type="button"
          onClick={() => setChecksExpanded((v) => !v)}
          className={cn(
            "flex w-full items-center gap-3 px-4 py-3 text-left",
            "outline-none transition-colors",
            checksExpanded ? "bg-muted/50" : "hover:bg-muted/50",
          )}
        >
          <ChevronRight
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground transition-transform",
              checksExpanded && "rotate-90"
            )}
          />
          {checksQuery.isPending ? (
            <>
              <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
              <span className="text-ui text-muted-foreground">Loading checks…</span>
            </>
          ) : !summary || summary.total === 0 ? (
            <>
              <Circle className="size-4 shrink-0 text-[var(--color-fg-faint)]" />
              <span className="text-ui text-muted-foreground">No checks</span>
            </>
          ) : (
            <>
              <SummaryIcon summary={summary} />
              <div className="flex-1 flex items-center gap-2">
                <span className="text-ui text-foreground">
                  {summary.failing > 0 ? (
                    <>
                      <span className="font-medium text-[var(--color-danger)]">{summary.failing} failing</span>
                      <span className="text-muted-foreground mx-1">·</span>
                      <span>{summary.passing} passed</span>
                    </>
                  ) : summary.pending > 0 ? (
                    <>
                      <span className="font-medium text-[var(--color-warning)]">{summary.pending} pending</span>
                      <span className="text-muted-foreground mx-1">·</span>
                      <span>{summary.passing} passed</span>
                    </>
                  ) : (
                    <span className="font-medium text-[var(--color-success)]">All checks passed</span>
                  )}
                </span>
              </div>
              {summary.total > 0 && <ProgressBar summary={summary} />}
            </>
          )}
        </button>

        {/* Expanded check list */}
        {checksExpanded && data && (
          <div className="bg-background/50 border-t border-border/30">
            {data.checkRuns.map((run) => (
              <CheckRunRow key={run.id} run={run} />
            ))}
            {data.combined.statuses.map((s) => (
              <StatusRow key={s.id} status={s} />
            ))}
          </div>
        )}
      </div>

      {/* Merge readiness */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {hasConflicts ? (
            <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-danger)]">
              <XCircle className="size-3.5 text-white" />
            </div>
          ) : mergeable === null ? (
            <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-warning)]">
              <Loader2 className="size-3.5 animate-spin text-white" />
            </div>
          ) : state === "draft" ? (
            <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted-foreground">
              <Circle className="size-3.5 text-white" />
            </div>
          ) : (
            <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-success)]">
              <CheckCircle2 className="size-3.5 text-white" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-ui font-medium text-foreground">
              {hasConflicts
                ? "Conflicts must be resolved"
                : mergeable === null
                  ? "Checking mergeability…"
                  : state === "draft"
                    ? "Draft pull request"
                    : "Ready to merge"}
            </p>
            <p className="mt-0.5 text-caption text-muted-foreground">
              {hasConflicts
                ? "This branch has conflicts with the base branch."
                : mergeable === null
                  ? "GitHub is computing whether this can be merged."
                  : state === "draft"
                    ? "Mark as ready for review to enable merging."
                    : "This branch is up to date with the base branch."}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-3 flex items-center gap-2">
          {state !== "draft" && !hasConflicts && mergeable && (
            <Button size="sm" disabled={merge.isPending} onClick={() => setMergeOpen(true)}>
              <GitMerge data-icon="inline-start" />
              Merge
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            disabled={toggleState.isPending}
            onClick={() => toggleState.mutate({ state: "closed" })}
          >
            Close
          </Button>
        </div>
      </div>

      <PrMergeDialog
        open={mergeOpen}
        onOpenChange={setMergeOpen}
        pr={pr}
        isPending={merge.isPending}
        onConfirm={(vars) => merge.mutate(vars, { onSuccess: () => setMergeOpen(false) })}
      />
    </div>
  );
}

// ─── Progress bar ──────────────────────────────────────────────────────────

type CheckSummary = { passing: number; failing: number; pending: number; total: number };

function ProgressBar({ summary }: { summary: CheckSummary }) {
  return (
    <div className="flex h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-[var(--color-bg-sunken)]">
      {summary.passing > 0 && (
        <div className="h-full bg-[var(--color-success)]" style={{ width: `${(summary.passing / summary.total) * 100}%` }} />
      )}
      {summary.pending > 0 && (
        <div className="h-full bg-[var(--color-warning)]" style={{ width: `${(summary.pending / summary.total) * 100}%` }} />
      )}
      {summary.failing > 0 && (
        <div className="h-full bg-[var(--color-danger)]" style={{ width: `${(summary.failing / summary.total) * 100}%` }} />
      )}
    </div>
  );
}

function SummaryIcon({ summary }: { summary: CheckSummary }) {
  if (summary.failing > 0) return <XCircle className="size-4 shrink-0 text-[var(--color-danger)]" />;
  if (summary.pending > 0) return <CircleDot className="size-4 shrink-0 text-[var(--color-warning)]" />;
  return <CheckCircle2 className="size-4 shrink-0 text-[var(--color-success)]" />;
}

// ─── Individual check rows ─────────────────────────────────────────────────

function CheckRunRow({ run }: { run: CheckRun }) {
  const { Icon, tone } = iconForCheckRun(run);
  const url = run.html_url ?? run.details_url ?? undefined;
  return (
    <div className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-muted/50">
      <Icon className={cn("size-4 shrink-0", tone)} />
      <span className="min-w-0 flex-1 truncate text-caption text-foreground">{run.name}</span>
      {run.app?.name && (
        <span className="shrink-0 rounded bg-muted px-1.5 text-micro text-muted-foreground">{run.app.name}</span>
      )}
      {run.completed_at && (
        <span className="shrink-0 text-micro text-[var(--color-fg-faint)]">{formatRelativeTime(run.completed_at)}</span>
      )}
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded text-caption text-muted-foreground hover:text-foreground hover:bg-muted px-1.5 py-0.5">
          Details <ExternalLink className="inline size-3" />
        </a>
      )}
    </div>
  );
}

function StatusRow({ status }: { status: { id: number; state: "pending" | "success" | "failure" | "error"; context: string; description: string | null; target_url: string | null; updated_at: string } }) {
  const { Icon, tone } = iconForState(status.state);
  return (
    <div className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-muted/50">
      <Icon className={cn("size-4 shrink-0", tone)} />
      <span className="min-w-0 flex-1 truncate text-caption text-foreground">{status.context}</span>
      {status.description && (
        <span className="shrink-0 max-w-40 truncate text-micro text-muted-foreground">{status.description}</span>
      )}
      <span className="shrink-0 text-micro text-[var(--color-fg-faint)]">{formatRelativeTime(status.updated_at)}</span>
      {status.target_url && (
        <a href={status.target_url} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded text-caption text-muted-foreground hover:text-foreground hover:bg-muted px-1.5 py-0.5">
          Details <ExternalLink className="inline size-3" />
        </a>
      )}
    </div>
  );
}

// ─── Icon mappings ─────────────────────────────────────────────────────────

function iconForCheckRun(run: CheckRun): { Icon: LucideIcon; tone: string } {
  if (run.status !== "completed") {
    if (run.status === "in_progress") return { Icon: Loader2, tone: "text-[var(--color-warning)] animate-spin" };
    return { Icon: Clock, tone: "text-[var(--color-warning)]" };
  }
  switch (run.conclusion) {
    case "success": return { Icon: CheckCircle2, tone: "text-[var(--color-success)]" };
    case "failure":
    case "timed_out": return { Icon: XCircle, tone: "text-[var(--color-danger)]" };
    case "action_required": return { Icon: CircleDot, tone: "text-[var(--color-warning)]" };
    case "cancelled":
    case "skipped": return { Icon: MinusCircle, tone: "text-[var(--color-fg-faint)]" };
    default: return { Icon: Circle, tone: "text-[var(--color-fg-faint)]" };
  }
}

function iconForState(s: "pending" | "success" | "failure" | "error"): { Icon: LucideIcon; tone: string } {
  switch (s) {
    case "success": return { Icon: CheckCircle2, tone: "text-[var(--color-success)]" };
    case "failure":
    case "error": return { Icon: XCircle, tone: "text-[var(--color-danger)]" };
    default: return { Icon: Clock, tone: "text-[var(--color-warning)]" };
  }
}

function summarizeChecks(data: PrChecksData): CheckSummary {
  let passing = 0;
  let failing = 0;
  let pending = 0;
  for (const r of data.checkRuns) {
    if (r.status !== "completed") pending++;
    else if (r.conclusion === "success" || r.conclusion === "skipped" || r.conclusion === "neutral") passing++;
    else if (r.conclusion === "failure" || r.conclusion === "timed_out") failing++;
    else passing++;
  }
  for (const s of data.combined.statuses) {
    if (s.state === "success") passing++;
    else if (s.state === "failure" || s.state === "error") failing++;
    else pending++;
  }
  return { passing, failing, pending, total: passing + failing + pending };
}