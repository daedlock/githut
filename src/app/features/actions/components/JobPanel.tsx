import { ChevronRight } from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { StatusIcon } from "@/app/components/ui/StatusPill";
import { formatDuration } from "@/app/components/ui/Timeline";
import { LogViewer } from "@/app/features/actions/components/LogViewer";
import { useJobLogs } from "@/app/features/actions/hooks";
import { parseLog } from "@/app/features/actions/lib/parseLog";
import { splitLogByStep } from "@/app/features/actions/lib/splitLogByStep";
import {
  durationMs as elapsedDuration,
  isTerminal,
  toUiStatus,
} from "@/app/features/actions/lib/statusMap";
import { useNow } from "@/app/features/actions/lib/useNow";
import type { Job, Step } from "@/app/features/actions/schemas";
import { cn } from "@/app/lib/cn";

const LOG_MATERIALIZATION_GRACE_MS = 5 * 60_000;

export type JobPanelProps = {
  owner: string;
  repo: string;
  job: Job;
  /** Expanded by default when true (first job on a run, or any live job). */
  defaultOpen?: boolean;
};

// ─── JobPanel ──────────────────────────────────────────────────────────────
//
// Collapsible job header + a per-step disclosure list inside. Each step
// has its own log segment. Logs are fetched once per job (GitHub only
// exposes a per-job logs endpoint) and split client-side by timestamp
// windows so each step disclosure shows only its own output. Steps that
// haven't started yet render without a chevron and without a log slot.

export function JobPanel({ owner, repo, job, defaultOpen = false }: JobPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const now = useNow();
  const ui = toUiStatus(job.status, job.conclusion);
  const isLive = !isTerminal(ui);
  const durationMs = elapsedDuration(
    job.started_at,
    job.completed_at,
    job.status === "in_progress",
    now,
  );
  const completedAtMs = millisFromIso(job.completed_at);
  const logPollUntil =
    !isLive && completedAtMs !== null ? completedAtMs + LOG_MATERIALIZATION_GRACE_MS : undefined;
  const logsStillMaterializing = logPollUntil !== undefined && Date.now() < logPollUntil;

  // Which step is actively running right now (started but not completed)?
  // Drives auto-expand + the collapsed-header "▶ current step" hint.
  const activeStep = useMemo(
    () => job.steps.find((s) => s.status === "in_progress") ?? null,
    [job.steps],
  );

  const anyStepStarted = job.steps.some((s) => !!s.started_at);
  const logsQuery = useJobLogs(owner, repo, job.id, {
    // Don't fetch until at least one step has started — jobs still in the
    // queue have no logs and GitHub returns 404 for them. Completed jobs get
    // a short grace polling window because the Azure log blob often appears
    // after GitHub has already marked the step green.
    enabled: open && anyStepStarted,
    isLive,
    pollUntil: logPollUntil,
  });
  const logErrorStatus = statusFromLogError(logsQuery.error);
  const logsTransient = isTransientLogStatus(logErrorStatus) && (isLive || logsStillMaterializing);
  const logsHardError = logsQuery.isError && !logsTransient;

  // Parse once per fetch; slice per step. Both memoise on the raw string
  // reference, which only changes when a poll returned new bytes.
  const parsedLines = useMemo(
    () => (logsQuery.data ? parseLog(logsQuery.data) : []),
    [logsQuery.data],
  );
  const stepLogs = useMemo(() => splitLogByStep(parsedLines, job.steps), [parsedLines, job.steps]);

  return (
    <div className="rounded-lg">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={`job-${job.id}-body`}
        className={cn(
          "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left outline-none transition-colors",
          "hover:bg-muted focus-visible:bg-muted",
        )}
      >
        <ChevronRight
          className={cn(
            "size-3.5 shrink-0 text-(--color-fg-faint) transition-transform duration-100",
            open && "rotate-90",
          )}
          aria-hidden
        />
        <StatusIcon variant={ui.kind} size={4} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate font-sans text-ui font-medium text-foreground">
          {job.name}
        </span>

        {/* Collapsed-state hint: surfaces what's actually happening even
            when the panel is closed so the user doesn't have to expand to
            see liveness. */}
        {isLive && activeStep && !open ? (
          <span className="hidden items-center gap-1.5 text-caption text-(--color-warning) @2xl/pane:inline-flex">
            <span className="animate-pulse">▶</span>
            <span className="font-mono truncate max-w-[220px]">{activeStep.name}</span>
          </span>
        ) : null}

        <span
          className={cn(
            "shrink-0 font-mono text-caption tabular-nums",
            ui.kind === "running"
              ? "text-(--color-warning)"
              : ui.kind === "failure"
                ? "text-(--color-danger)"
                : "text-muted-foreground",
          )}
        >
          {durationMs !== null ? formatDuration(durationMs) : "—"}
        </span>
      </button>

      {open ? (
        <div
          id={`job-${job.id}-body`}
          className="ml-6 flex flex-col gap-1 border-l border-border/60 py-1"
        >
          {logsHardError ? (
            <div
              role="alert"
              className="flex items-center justify-between gap-3 px-4 py-2 text-caption text-destructive"
            >
              <span>Could not load job logs.</span>
              <button
                type="button"
                onClick={() => logsQuery.refetch()}
                className="rounded px-2 py-1 underline focus-visible:ring-2 focus-visible:ring-ring"
              >
                Retry logs
              </button>
            </div>
          ) : null}
          {job.steps.length === 0 ? (
            <p className="px-10 py-3 font-mono text-caption text-(--color-fg-faint)">
              No steps recorded.
            </p>
          ) : (
            job.steps.map((step) => (
              <StepWithLogs
                key={step.number}
                step={step}
                lines={stepLogs.get(step.number) ?? []}
                isActive={activeStep?.number === step.number}
                logsPreparing={
                  !!step.started_at &&
                  (logsQuery.isPending ||
                    logsTransient ||
                    (!logsQuery.data && (isLive || logsStillMaterializing)))
                }
                logsError={logsHardError}
                errorStatus={logErrorStatus}
              />
            ))
          )}

          {!anyStepStarted ? (
            <p className="px-10 py-4 font-mono text-caption text-(--color-fg-faint)">
              {isLive
                ? "Waiting for a runner. Step status updates automatically; logs appear when GitHub makes them available."
                : "No steps ran in this job."}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ─── Step row with inline log disclosure ───────────────────────────────────

type StepWithLogsProps = {
  step: Step;
  lines: import("@/app/features/actions/lib/parseLog").LogLine[];
  isActive: boolean;
  logsPreparing: boolean;
  logsError: boolean;
  errorStatus?: number;
};

const StepWithLogs = memo(function StepWithLogs({
  step,
  lines,
  isActive,
  logsPreparing,
  logsError,
  errorStatus,
}: StepWithLogsProps) {
  const now = useNow();
  const ui = toUiStatus(step.status, step.conclusion);
  const hasStarted = !!step.started_at;
  const durationMs = elapsedDuration(
    step.started_at,
    step.completed_at,
    step.status === "in_progress",
    now,
  );

  // Expand the active step by default; others collapsed. Track locally so
  // user can override. When a new step becomes active, auto-expand it
  // (one-shot — we don't re-expand if user closed it).
  const [open, setOpen] = useState(isActive || ui.kind === "failure" || ui.kind === "timed_out");
  const prevActive = useRef(isActive);
  useEffect(() => {
    if (isActive && !prevActive.current) setOpen(true);
    prevActive.current = isActive;
  }, [isActive]);

  const canExpand = hasStarted;

  return (
    <div className={cn(isActive && "bg-(--color-bg-subtle)")}>
      <button
        type="button"
        disabled={!canExpand}
        aria-expanded={canExpand ? open : undefined}
        aria-controls={canExpand ? `step-${step.number}-logs` : undefined}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg py-1.5 pl-3 pr-4 text-left outline-none transition-colors",
          canExpand && "cursor-pointer hover:bg-muted focus-visible:bg-muted",
          !canExpand && "cursor-default",
        )}
      >
        {canExpand ? (
          <ChevronRight
            className={cn(
              "size-3 shrink-0 text-(--color-fg-faint) transition-transform duration-100",
              open && "rotate-90",
            )}
            aria-hidden
          />
        ) : (
          // Placeholder so unstarted steps stay aligned with started ones.
          <span className="size-3 shrink-0" aria-hidden />
        )}
        <StatusIcon variant={ui.kind} size={3} className="shrink-0" />
        <span className="w-6 shrink-0 text-right font-mono text-caption tabular-nums text-(--color-fg-faint)">
          {step.number}
        </span>
        <span
          className={cn(
            "min-w-0 flex-1 truncate font-sans text-caption",
            hasStarted ? "text-foreground" : "text-(--color-fg-faint)",
          )}
        >
          {step.name}
        </span>
        <span
          className={cn(
            "shrink-0 font-mono text-micro tabular-nums",
            ui.kind === "failure"
              ? "text-(--color-danger)"
              : isActive
                ? "text-(--color-warning)"
                : "text-(--color-fg-faint)",
          )}
        >
          {durationMs !== null ? formatDuration(durationMs) : "—"}
        </span>
      </button>

      {canExpand && open ? (
        <div id={`step-${step.number}-logs`}>
          <LogViewer
            lines={lines}
            isPending={false}
            isError={logsError}
            errorStatus={errorStatus}
            isLive={isActive}
            isPreparing={!isActive && logsPreparing && lines.length === 0}
            preparingLabel={
              logsPreparing && lines.length === 0 && isActive
                ? "Waiting for GitHub logs…"
                : undefined
            }
          />
        </div>
      ) : null}
    </div>
  );
});

// ─── Helpers ───────────────────────────────────────────────────────────────

function millisFromIso(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function statusFromLogError(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  if ("status" in error && typeof error.status === "number") return error.status;
  return undefined;
}

function isTransientLogStatus(status: number | undefined): boolean {
  if (status === undefined) return false;
  return status === 404 || status === 429 || status === 502 || status === 503 || status === 504;
}
