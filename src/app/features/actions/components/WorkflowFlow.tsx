import { Maximize2, Minus, Plus, Workflow } from "lucide-react";
import { memo, useMemo, useRef, useState } from "react";
import { Button } from "@/app/components/ui/button";
import { StatusIcon } from "@/app/components/ui/StatusPill";
import { formatDuration } from "@/app/components/ui/Timeline";
import { useRepoFile } from "@/app/hooks/useRepoFile";
import { cn } from "@/app/lib/cn";
import { durationMs, statusLabel, toUiStatus } from "../lib/statusMap";
import { useNow } from "../lib/useNow";
import { buildWorkflowGraph, NODE_WIDTH, parseWorkflow, ROW_HEIGHT } from "../lib/workflowGraph";
import type { Job, WorkflowRun } from "../schemas";

export function JobDuration({ job }: { job: Job }) {
  const now = useNow();
  const elapsed = durationMs(job.started_at, job.completed_at, job.status === "in_progress", now);
  return (
    <span className="shrink-0 text-caption tabular-nums text-muted-foreground">
      {elapsed === null ? "—" : formatDuration(elapsed)}
    </span>
  );
}

export const WorkflowFlow = memo(function WorkflowFlow({
  owner,
  repo,
  run,
  jobs,
  jobsPending,
  onSelectJob,
}: {
  owner: string;
  repo: string;
  run: WorkflowRun;
  jobs: Job[];
  jobsPending?: boolean;
  onSelectJob: (id: number) => void;
}) {
  const viewport = useRef<HTMLElement>(null);
  const [zoom, setZoom] = useState(1);
  const path = run.path.split("@")[0] ?? run.path;
  const file = useRepoFile(owner, repo, path, run.head_sha);
  const graph = useMemo(
    () => buildWorkflowGraph(file.data ? parseWorkflow(file.data.content) : { jobs: [] }, jobs),
    [file.data, jobs],
  );
  const byId = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph.nodes]);
  const fit = () => {
    const el = viewport.current;
    if (!el) return;
    setZoom(Math.max(0.35, Math.min(1, el.clientWidth / graph.width, 480 / graph.height)));
    el.scrollTo({ left: 0, top: 0 });
  };

  return (
    <section aria-label="Workflow visualization" className="overflow-hidden rounded-lg bg-muted">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-ui font-medium">
            <Workflow className="size-4 text-muted-foreground" aria-hidden />
            Workflow flow
          </h2>
          <p className="mt-1 truncate text-caption text-muted-foreground">
            {path.split("/").pop()} <span aria-hidden>·</span> {run.event}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Zoom out"
            disabled={zoom <= 0.35}
            onClick={() => setZoom((z) => Math.max(0.35, z - 0.15))}
          >
            <Minus />
          </Button>
          <span className="w-10 text-center text-caption tabular-nums text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Zoom in"
            disabled={zoom >= 1.5}
            onClick={() => setZoom((z) => Math.min(1.5, z + 0.15))}
          >
            <Plus />
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label="Fit workflow to view" onClick={fit}>
            <Maximize2 />
          </Button>
        </div>
      </div>
      {file.isPending ? (
        <p role="status" className="px-4 py-12 text-center text-ui text-muted-foreground">
          Loading workflow flow…
        </p>
      ) : (
        <>
          {file.isError || graph.warning ? (
            <p role="status" className="px-4 pb-3 text-caption text-muted-foreground">
              {graph.warning ??
                "Workflow file unavailable. Jobs are shown without dependency connections."}
              {file.isError ? (
                <button type="button" className="ml-2 underline" onClick={() => file.refetch()}>
                  Retry workflow
                </button>
              ) : null}
            </p>
          ) : null}
          {graph.nodes.length > 0 ? (
            <section
              ref={viewport}
              className="max-h-[520px] overflow-auto bg-background/50"
              // biome-ignore lint/a11y/noNoninteractiveTabindex: scrolling the graph must be keyboard accessible.
              tabIndex={0}
              aria-label="Workflow graph. Scroll to explore; select a job to view its steps."
            >
              <div style={{ width: graph.width * zoom, height: graph.height * zoom }}>
                <div
                  className="relative origin-top-left"
                  style={{ width: graph.width, height: graph.height, transform: `scale(${zoom})` }}
                >
                  <svg
                    className="pointer-events-none absolute inset-0 text-(--color-fg-faint)"
                    width={graph.width}
                    height={graph.height}
                    aria-hidden="true"
                  >
                    {graph.edges.map((edge) => {
                      const from = byId.get(edge.from)!;
                      const to = byId.get(edge.to)!;
                      const x1 = from.x + NODE_WIDTH,
                        y1 = from.y + from.height / 2;
                      const x2 = to.x,
                        y2 = to.y + to.height / 2;
                      const middle = (x1 + x2) / 2;
                      return (
                        <g key={`${edge.from}:${edge.to}`}>
                          <path
                            d={`M ${x1} ${y1} C ${middle} ${y1}, ${middle} ${y2}, ${x2} ${y2}`}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={1.5}
                            opacity={0.55}
                          />
                          <circle cx={x1} cy={y1} r={3} fill="currentColor" />
                          <circle cx={x2} cy={y2} r={3} fill="currentColor" />
                        </g>
                      );
                    })}
                  </svg>
                  {graph.nodes.map((node) => {
                    const grouped = node.matrix || node.reusable || node.jobs.length > 1;
                    return (
                      <div
                        key={node.id}
                        className="absolute overflow-hidden rounded-lg bg-muted ring-1 ring-border"
                        style={{
                          left: node.x,
                          top: node.y,
                          width: NODE_WIDTH,
                          height: node.height,
                        }}
                      >
                        {grouped ? (
                          <div
                            className="flex h-9 items-center gap-2 px-3 text-caption font-medium"
                            title={node.name}
                          >
                            <span className="truncate">{node.name}</span>
                            <span className="ml-auto shrink-0 text-micro text-muted-foreground">
                              {node.matrix ? "Matrix" : "Workflow"}
                            </span>
                          </div>
                        ) : null}
                        {node.jobs.length ? (
                          node.jobs.map((job) => (
                            <FlowJob key={job.id} job={job} onSelectJob={onSelectJob} />
                          ))
                        ) : (
                          <div
                            className="flex flex-col justify-center gap-1 px-3"
                            style={{ height: ROW_HEIGHT }}
                          >
                            {!grouped ? (
                              <p className="truncate text-ui font-medium" title={node.name}>
                                {node.name}
                              </p>
                            ) : null}
                            <p className="text-caption text-muted-foreground">
                              {jobsPending
                                ? "Loading job status…"
                                : run.status === "completed"
                                  ? "Not reported in this attempt"
                                  : node.needs.length
                                    ? "Waiting for dependencies"
                                    : "Not started"}
                            </p>
                          </div>
                        )}
                        <span className="sr-only">
                          {node.needs.length
                            ? `Depends on ${node.needs.join(", ")}`
                            : "No dependencies"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          ) : null}
          {graph.unmatched.length ? (
            <div className="p-4">
              {graph.nodes.length ? (
                <p className="mb-2 text-caption text-muted-foreground">
                  Additional jobs · dependency mapping unavailable
                </p>
              ) : null}
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {graph.unmatched.map((job) => (
                  <div key={job.id} className="rounded-lg bg-background/50">
                    <FlowJob job={job} onSelectJob={onSelectJob} />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {!graph.nodes.length && !jobs.length ? (
            <p className="px-4 py-12 text-center text-ui text-muted-foreground">
              {jobsPending ? "Loading jobs…" : "No jobs reported yet."}
            </p>
          ) : null}
        </>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-caption text-muted-foreground">
        <span>Select a job to view steps and logs</span>
        <span className="ml-auto inline-flex items-center gap-1.5">
          <StatusIcon variant="success" size={3} />
          Success
        </span>
        <span className="inline-flex items-center gap-1.5">
          <StatusIcon variant="running" size={3} />
          In progress
        </span>
        <span className="inline-flex items-center gap-1.5">
          <StatusIcon variant="queued" size={3} />
          Queued
        </span>
        <span className="inline-flex items-center gap-1.5">
          <StatusIcon variant="failure" size={3} />
          Failure
        </span>
      </div>
    </section>
  );
});

function FlowJob({ job, onSelectJob }: { job: Job; onSelectJob: (id: number) => void }) {
  const ui = toUiStatus(job.status, job.conclusion);
  return (
    <button
      type="button"
      onClick={() => onSelectJob(job.id)}
      title={`${job.name} · ${statusLabel(ui)}`}
      className={cn(
        "flex w-full items-center gap-3 px-3 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
      )}
      style={{ height: ROW_HEIGHT }}
      aria-label={`${job.name}: ${statusLabel(ui)}. View steps and logs`}
    >
      <StatusIcon variant={ui.kind} className="shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-ui font-medium">{job.name}</span>
        <span className="block text-caption text-muted-foreground">{statusLabel(ui)}</span>
      </span>
      <JobDuration job={job} />
    </button>
  );
}
