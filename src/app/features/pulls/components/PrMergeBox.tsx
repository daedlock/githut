import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
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

// ─── PrMergeBox ────────────────────────────────────────────────────────────
//
// GitHub-parity merge section at the bottom of the conversation tab.
// Three vertically stacked sections:
//   1. Checks — collapsible list of CI check runs + legacy statuses with
//      progress summary, icons, app badges, and "Details" deep-links.
//   2. Merge readiness — conflicts / clean / computing status.
//   3. Action bar — Merge / Close / Reopen buttons.
//
// Polls while non-terminal via `usePrChecks`. Terminal states (merged,
// closed) show a compact status card without the checks list.

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

  // ── Terminal states ────────────────────────────────────────────────
  if (state === "merged") {
    return (
      <Shell tone="merged">
        <div className="flex items-center gap-3 px-4 py-3">
          <GitMerge className="size-5 shrink-0 text-[var(--color-pr-merged)]" />
          <div>
            <p className="text-body font-medium text-foreground">
              Pull request successfully merged and closed.
            </p>
            {pr.merged_by && (
              <p className="text-caption text-muted-foreground">
                Merged by {pr.merged_by.login}
              </p>
            )}
          </div>
        </div>
      </Shell>
    );
  }

  if (state === "closed") {
    return (
      <Shell tone="closed">
        <div className="flex items-center gap-3 px-4 py-3">
          <GitPullRequestClosed className="size-5 shrink-0 text-[var(--color-danger)]" />
          <div className="flex-1">
            <p className="text-body font-medium text-foreground">
              This pull request is closed.
            </p>
          </div>
          <Button
            size="sm"
            disabled={toggleState.isPending}
            onClick={() => toggleState.mutate({ state: "open" })}
          >
            Reopen pull request
          </Button>
        </div>
      </Shell>
    );
  }

  // ── Open / draft ──────────────────────────────────────────────────
  const mergeable = pr.mergeable;
  const hasConflicts = pr.mergeable_state === "dirty" || mergeable === false;
  const data = checksQuery.data;
  const summary = data ? summarizeChecks(data) : null;

  const overallTone: "ready" | "conflict" | "pending" =
    hasConflicts
      ? "conflict"
      : summary?.failing
        ? "conflict"
        : summary?.pending
          ? "pending"
          : "ready";

  return (
    <Shell tone={overallTone}>
      {/* ── Checks section ───────────────────────────────────────────── */}
      <div className="border-b border-border/50">
        <button
          type="button"
          onClick={() => setChecksExpanded((v) => !v)}
          className={cn(
            "flex w-full items-center gap-3 px-4 py-3 text-left",
            "outline-none transition-colors hover:bg-[var(--color-bg-sunken)]",
          )}
        >
          {checksExpanded ? (
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
          )}
          {checksQuery.isPending ? (
            <>
              <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
              <span className="text-body text-muted-foreground">
                Loading checks…
              </span>
            </>
          ) : !summary || summary.total === 0 ? (
            <>
              <Circle className="size-4 shrink-0 text-[var(--color-fg-faint)]" />
              <span className="text-body text-muted-foreground">
                No status checks reported
              </span>
            </>
          ) : (
            <>
              <SummaryIcon summary={summary} />
              <span className="flex-1 text-body text-foreground">
                {summary.failing > 0 ? (
                  <>
                    <span className="font-medium">
                      {summary.failing} failing
                    </span>
                    {" and "}
                    <span className="font-medium">
                      {summary.passing} successful
                    </span>
                    {" checks"}
                  </>
                ) : summary.pending > 0 ? (
                  <>
                    <span className="font-medium">
                      {summary.pending} pending
                    </span>
                    {" and "}
                    <span className="font-medium">
                      {summary.passing} successful
                    </span>
                    {" checks"}
                  </>
                ) : (
                  <>
                    All{" "}
                    <span className="font-medium">{summary.passing}</span>
                    {" checks have passed"}
                  </>
                )}
              </span>
              {/* Mini progress bar */}
              {summary.total > 0 && (
                <ProgressBar summary={summary} />
              )}
            </>
          )}
        </button>

        {/* Expanded check list */}
        {checksExpanded && data && (
          <div className="border-t border-border/50">
            {data.checkRuns.map((run) => (
              <CheckRunRow key={run.id} run={run} />
            ))}
            {data.combined.statuses.map((s) => (
              <StatusRow key={s.id} status={s} />
            ))}
            {data.checkRuns.length === 0 && data.combined.statuses.length === 0 && (
              <div className="px-4 py-3 text-caption text-muted-foreground">
                No checks have reported yet.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Merge readiness ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        {hasConflicts ? (
          <XCircle className="size-5 shrink-0 text-[var(--color-danger)]" />
        ) : mergeable === null ? (
          <Loader2 className="size-5 shrink-0 animate-spin text-[var(--color-warning)]" />
        ) : (
          <CheckCircle2 className="size-5 shrink-0 text-[var(--color-success)]" />
        )}
        <div className="flex-1">
          <p className="text-body font-medium text-foreground">
            {hasConflicts
              ? "This branch has conflicts that must be resolved."
              : mergeable === null
                ? "Mergeability is being computed…"
                : state === "draft"
                  ? "This pull request is still a draft."
                  : "This branch has no conflicts with the base branch."}
          </p>
          {!hasConflicts && mergeable && state !== "draft" && (
            <p className="text-caption text-muted-foreground">
              Merging can be performed automatically.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {state !== "draft" && !hasConflicts && mergeable && (
            <Button
              size="sm"
              disabled={merge.isPending}
              onClick={() => setMergeOpen(true)}
            >
              <GitMerge data-icon="inline-start" />
              Merge pull request
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={toggleState.isPending}
            onClick={() => toggleState.mutate({ state: "closed" })}
          >
            Close pull request
          </Button>
        </div>
      </div>

      <PrMergeDialog
        open={mergeOpen}
        onOpenChange={setMergeOpen}
        pr={pr}
        isPending={merge.isPending}
        onConfirm={(vars) =>
          merge.mutate(vars, { onSuccess: () => setMergeOpen(false) })
        }
      />
    </Shell>
  );
}

// ─── Shell ─────────────────────────────────────────────────────────────────

function Shell({
  tone,
  children,
}: {
  tone: "ready" | "conflict" | "merged" | "closed" | "pending";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border",
        tone === "ready" &&
          "border-[var(--color-success)]/30 bg-[color-mix(in_oklab,var(--color-success)_4%,var(--color-bg))]",
        tone === "conflict" &&
          "border-[var(--color-danger)]/30 bg-[color-mix(in_oklab,var(--color-danger)_4%,var(--color-bg))]",
        tone === "pending" &&
          "border-[var(--color-warning)]/30 bg-[color-mix(in_oklab,var(--color-warning)_4%,var(--color-bg))]",
        tone === "merged" &&
          "border-[var(--color-pr-merged)]/30 bg-[color-mix(in_oklab,var(--color-pr-merged)_4%,var(--color-bg))]",
        tone === "closed" &&
          "border-border bg-[var(--color-bg-subtle)]",
      )}
    >
      {children}
    </div>
  );
}

// ─── Progress bar ──────────────────────────────────────────────────────────

type CheckSummary = { passing: number; failing: number; pending: number; total: number };

function ProgressBar({ summary }: { summary: CheckSummary }) {
  const pPassing = (summary.passing / summary.total) * 100;
  const pFailing = (summary.failing / summary.total) * 100;
  return (
    <div className="flex h-2 w-20 shrink-0 overflow-hidden rounded-full bg-[var(--color-bg-sunken)]">
      {summary.passing > 0 && (
        <div
          className="h-full bg-[var(--color-success)]"
          style={{ width: `${pPassing}%` }}
        />
      )}
      {summary.failing > 0 && (
        <div
          className="h-full bg-[var(--color-danger)]"
          style={{ width: `${pFailing}%` }}
        />
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
    <div className="flex items-center gap-2.5 px-4 py-2 transition-colors hover:bg-[var(--color-bg-sunken)]">
      <Icon className={cn("size-4 shrink-0", tone)} />
      <span className="min-w-0 flex-1 truncate text-caption text-foreground">
        {run.name}
      </span>
      {run.app?.name && (
        <span className="shrink-0 rounded-sm bg-[var(--color-bg-sunken)] px-1.5 py-0.5 text-micro text-muted-foreground">
          {run.app.name}
        </span>
      )}
      {run.completed_at && (
        <span className="shrink-0 text-micro text-[var(--color-fg-faint)]">
          {formatRelativeTime(run.completed_at)}
        </span>
      )}
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-1 text-caption text-muted-foreground hover:text-foreground"
        >
          Details
          <ExternalLink className="size-3" />
        </a>
      )}
    </div>
  );
}

function StatusRow({
  status,
}: {
  status: {
    id: number;
    state: "pending" | "success" | "failure" | "error";
    context: string;
    description: string | null;
    target_url: string | null;
    updated_at: string;
  };
}) {
  const { Icon, tone } = iconForState(status.state);
  return (
    <div className="flex items-center gap-2.5 px-4 py-2 transition-colors hover:bg-[var(--color-bg-sunken)]">
      <Icon className={cn("size-4 shrink-0", tone)} />
      <span className="min-w-0 flex-1 truncate text-caption text-foreground">
        {status.context}
      </span>
      {status.description && (
        <span className="shrink-0 max-w-48 truncate text-micro text-muted-foreground">
          {status.description}
        </span>
      )}
      <span className="shrink-0 text-micro text-[var(--color-fg-faint)]">
        {formatRelativeTime(status.updated_at)}
      </span>
      {status.target_url && (
        <a
          href={status.target_url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-1 text-caption text-muted-foreground hover:text-foreground"
        >
          Details
          <ExternalLink className="size-3" />
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
    case "action_required": return { Icon: AlertCircle, tone: "text-[var(--color-warning)]" };
    case "cancelled":
    case "skipped": return { Icon: MinusCircle, tone: "text-[var(--color-fg-faint)]" };
    default: return { Icon: Circle, tone: "text-[var(--color-fg-faint)]" };
  }
}

function iconForState(s: "pending" | "success" | "failure" | "error") {
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
