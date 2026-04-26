import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, ChevronRight, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useJob, useJobLogs } from "@/app/features/actions/hooks";
import { parseLog } from "@/app/features/actions/lib/parseLog";
import { splitLogByStep } from "@/app/features/actions/lib/splitLogByStep";
import { toUiStatus } from "@/app/features/actions/lib/statusMap";
import type { Step } from "@/app/features/actions/schemas";
import { StatusIcon } from "@/app/components/ui/StatusPill";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import { Skeleton } from "@/app/components/ui/skeleton";
import { cn } from "@/app/lib/cn";

function extractIds(url: string): { runId: number; jobId: number } | null {
  const m = url.match(/\/actions\/runs\/(\d+)\/job\/(\d+)/);
  if (m) return { runId: Number(m[1]), jobId: Number(m[2]) };
  const runOnly = url.match(/\/actions\/runs\/(\d+)/);
  if (runOnly) return { runId: Number(runOnly[1]), jobId: 0 };
  return null;
}

export function CheckRunPeek({
  owner,
  repo,
  checkUrl,
  checkName,
  children,
}: {
  owner: string;
  repo: string;
  checkUrl: string;
  checkName: string;
  children: React.ReactNode;
}) {
  const ids = extractIds(checkUrl);
  if (!ids) return <>{children}</>;

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        side="left"
        align="start"
        sideOffset={8}
        className="overflow-hidden p-0 transition-[width] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ width: "var(--peek-w, 280px)" }}
      >
        <PeekBody owner={owner} repo={repo} runId={ids.runId} jobId={ids.jobId} checkName={checkName} />
      </PopoverContent>
    </Popover>
  );
}

type PeekView = { kind: "steps" } | { kind: "logs"; step: Step };

function PeekBody({
  owner,
  repo,
  runId,
  jobId,
  checkName,
}: {
  owner: string;
  repo: string;
  runId: number;
  jobId: number;
  checkName: string;
}) {
  const [view, setView] = useState<PeekView>({ kind: "steps" });
  const jobQuery = useJob(owner, repo, jobId);
  const job = jobQuery.data;
  const jobUi = job ? toUiStatus(job.status, job.conclusion) : null;
  const isLive = jobUi?.kind === "running" || jobUi?.kind === "queued";

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current?.closest("[style*='--peek-w']") as HTMLElement | null;
    if (el) el.style.setProperty("--peek-w", view.kind === "logs" ? "480px" : "280px");
  }, [view.kind]);

  return (
    <div ref={containerRef}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        {view.kind === "logs" && (
          <button
            type="button"
            onClick={() => setView({ kind: "steps" })}
            className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors duration-75 hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
          </button>
        )}
        {job ? (
          <StatusIcon variant={jobUi!.kind} size={4} />
        ) : (
          <Skeleton className="size-4 rounded-full" />
        )}
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
          {view.kind === "logs" ? view.step.name : checkName}
        </span>
      </div>

      <div className="border-t border-[var(--color-border)]">
        {view.kind === "steps" ? (
          <StepsPane
            job={job}
            isLive={isLive}
            onStepClick={(step) => setView({ kind: "logs", step })}
          />
        ) : (
          <LogsPane owner={owner} repo={repo} jobId={jobId} job={job} step={view.step} isLive={isLive} />
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-[var(--color-border)] px-3 py-2">
        <Link
          to="/$owner/$repo/actions/runs/$runId"
          params={{ owner, repo, runId: String(runId) }}
          className={cn(
            "group/link inline-flex w-full items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5",
            "text-xs font-medium text-foreground",
            "bg-[var(--color-bg-sunken)] transition-all duration-100 ease-[cubic-bezier(0.16,1,0.3,1)]",
            "hover:bg-muted active:translate-y-px",
          )}
        >
          View full run
          <ArrowRight className="size-3 transition-transform duration-100 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/link:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
}

// ─── Steps pane ───────────────────────────────────────────────────────────

function StepsPane({
  job,
  isLive,
  onStepClick,
}: {
  job: ReturnType<typeof useJob>["data"];
  isLive: boolean;
  onStepClick: (step: Step) => void;
}) {
  if (!job) {
    return (
      <div className="flex flex-col gap-0.5 px-3 py-1.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 py-1">
            <Skeleton className="size-3 rounded-full" />
            <Skeleton className="h-2.5" style={{ width: `${45 + ((i * 23) % 40)}%` }} />
          </div>
        ))}
      </div>
    );
  }

  if (job.steps.length === 0) {
    return (
      <div className="px-3 py-4 text-center text-xs text-muted-foreground">
        {isLive ? "Waiting for steps…" : "No steps"}
      </div>
    );
  }

  return (
    <div className="max-h-[240px] overflow-y-auto py-0.5">
      {job.steps.map((step) => {
        const ui = toUiStatus(step.status, step.conclusion);
        const clickable = !!step.started_at;
        return (
          <button
            key={step.number}
            type="button"
            disabled={!clickable}
            onClick={() => onStepClick(step)}
            className={cn(
              "flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors duration-75",
              clickable
                ? "hover:bg-muted/50 cursor-default"
                : "opacity-50 cursor-not-allowed",
            )}
          >
            <StatusIcon variant={ui.kind} size={3} />
            <span className="min-w-0 flex-1 truncate text-xs text-foreground">
              {step.name}
            </span>
            {step.completed_at && step.started_at && (
              <span className="shrink-0 font-mono text-micro text-[var(--color-fg-faint)]">
                {fmtDuration(step.started_at, step.completed_at)}
              </span>
            )}
            {clickable && <ChevronRight className="size-3 shrink-0 text-[var(--color-fg-faint)]" />}
          </button>
        );
      })}
    </div>
  );
}

// ─── Logs pane ────────────────────────────────────────────────────────────

function LogsPane({
  owner,
  repo,
  jobId,
  job,
  step,
  isLive,
}: {
  owner: string;
  repo: string;
  jobId: number;
  job: ReturnType<typeof useJob>["data"];
  step: Step;
  isLive: boolean;
}) {
  const logsQuery = useJobLogs(owner, repo, jobId, { isLive });
  const scrollRef = useRef<HTMLPreElement>(null);

  const lines = useMemo(() => {
    if (!logsQuery.data || !job) return [];
    const parsed = parseLog(logsQuery.data);
    const byStep = splitLogByStep(parsed, job.steps);
    return byStep.get(step.number) ?? [];
  }, [logsQuery.data, job, step.number]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  if (logsQuery.isPending) {
    return (
      <div className="flex items-center justify-center gap-2 py-8">
        <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Loading logs…</span>
      </div>
    );
  }

  if (logsQuery.isError) {
    return (
      <div className="px-3 py-6 text-center text-xs text-muted-foreground">
        Could not load logs
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="px-3 py-6 text-center text-xs text-muted-foreground">
        No output
      </div>
    );
  }

  return (
    <pre
      ref={scrollRef}
      className={cn(
        "max-h-[300px] overflow-auto bg-[var(--color-code-bg)] px-3 py-2",
        "font-mono text-[11px] leading-[18px] text-foreground",
        "select-text",
      )}
    >
      {lines.map((line, i) => {
        const text = line.tokens.map((t) => t.content).join("");
        const isFail = line.level === "error";
        const isWarn = line.level === "warning";
        return (
          <div
            key={i}
            className={cn(
              "whitespace-pre-wrap break-all",
              isFail && "text-[var(--color-danger)]",
              isWarn && "text-[var(--color-warning)]",
            )}
          >
            {text}
          </div>
        );
      })}
    </pre>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function fmtDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return "<1s";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}
