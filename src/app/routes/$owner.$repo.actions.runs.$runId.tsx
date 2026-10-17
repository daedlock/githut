import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, ArrowLeft, ExternalLink, LayoutDashboard, RefreshCw } from "lucide-react";
import { useCallback } from "react";
import { z } from "zod";
import { Button } from "@/app/components/ui/button";
import { Container } from "@/app/components/ui/Container";
import { StatusIcon, StatusPill } from "@/app/components/ui/StatusPill";
import { Skeleton } from "@/app/components/ui/skeleton";
import { ArtifactList } from "@/app/features/actions/components/ArtifactList";
import { JobPanel } from "@/app/features/actions/components/JobPanel";
import {
  JobListSkeleton,
  RunDetailSkeleton,
} from "@/app/features/actions/components/RunDetailSkeleton";
import {
  RunHeader,
  RunOverview,
  WorkflowFileLink,
} from "@/app/features/actions/components/RunHeader";
import { JobDuration, WorkflowFlow } from "@/app/features/actions/components/WorkflowFlow";
import {
  useRunArtifacts,
  useRunJobs,
  useWorkflowRun,
  workflowRunQueryOptions,
} from "@/app/features/actions/hooks";
import { isTerminal, statusLabel, toUiStatus } from "@/app/features/actions/lib/statusMap";
import { NowTicker } from "@/app/features/actions/lib/useNow";
import { cn } from "@/app/lib/cn";

export const Route = createFileRoute("/$owner/$repo/actions/runs/$runId")({
  validateSearch: z.object({ job: z.coerce.number().int().positive().optional().catch(undefined) }),
  loader: ({ context, params }) => {
    const runId = Number(params.runId);
    if (Number.isSafeInteger(runId) && runId > 0)
      void context.queryClient.prefetchQuery(
        workflowRunQueryOptions(params.owner, params.repo, runId),
      );
  },
  component: RunDetailPage,
});

function RunDetailPage() {
  const { owner, repo, runId: rawId } = Route.useParams();
  const { job: jobId } = Route.useSearch();
  const navigate = Route.useNavigate();
  const runId = Number(rawId);
  const validId = Number.isSafeInteger(runId) && runId > 0;
  const runQuery = useWorkflowRun(owner, repo, runId);
  const run = runQuery.data;
  const jobsQuery = useRunJobs(owner, repo, runId, run);
  const artifactsQuery = useRunArtifacts(owner, repo, runId, run);
  const selectJob = useCallback(
    (id?: number) => {
      void navigate({ search: { job: id }, resetScroll: false });
    },
    [navigate],
  );
  const jobs = jobsQuery.data ?? [];
  const selected = jobs.find((job) => job.id === jobId);

  if (!validId || (!run && runQuery.isError))
    return (
      <Container className="py-8">
        <QueryError
          title={validId ? "Could not load this run." : "Invalid run ID."}
          retry={
            validId
              ? () => {
                  void runQuery.refetch();
                }
              : undefined
          }
        />
      </Container>
    );
  if (!run)
    return (
      <Container className="py-6">
        <RunDetailSkeleton />
      </Container>
    );

  const live = !isTerminal(toUiStatus(run.status, run.conclusion));
  const completed = jobs.filter((job) => job.status === "completed").length;
  return (
    <NowTicker enabled={live || jobs.some((j) => j.status !== "completed")}>
      <Container className="space-y-6 py-6">
        <RunHeader owner={owner} repo={repo} run={run} />
        {runQuery.isError ? (
          <QueryError
            title="Run updates are unavailable. Showing the last received state."
            retry={() => {
              void runQuery.refetch();
            }}
          />
        ) : null}
        <div className="flex flex-col items-start gap-6 lg:flex-row lg:gap-8">
          <aside className="w-full shrink-0 lg:sticky lg:top-8 lg:w-60" aria-label="Run navigation">
            <select
              aria-label="View summary or job"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-ui lg:hidden"
              value={jobId ?? ""}
              onChange={(event) =>
                selectJob(event.target.value ? Number(event.target.value) : undefined)
              }
            >
              <option value="">
                Summary · {completed}/{jobs.length} jobs completed
              </option>
              {jobId && !selected ? (
                <option value={jobId}>Job unavailable in this attempt</option>
              ) : null}
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.name} · {statusLabel(toUiStatus(job.status, job.conclusion))}
                </option>
              ))}
            </select>
            <div className="hidden lg:block">
              <button
                type="button"
                onClick={() => selectJob()}
                aria-current={!jobId ? "page" : undefined}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-ui hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
                  !jobId && "bg-muted font-medium",
                )}
              >
                <LayoutDashboard className="size-4" />
                Summary
              </button>
              <div className="mt-5 flex items-center justify-between px-3 text-caption text-muted-foreground">
                <h2>All jobs</h2>
                <span>{jobsQuery.data ? `${completed}/${jobs.length}` : "—"}</span>
              </div>
              <nav
                className="mt-2 max-h-64 space-y-1 overflow-y-auto lg:max-h-[55vh]"
                aria-label="Jobs"
              >
                {jobsQuery.isPending
                  ? [1, 2, 3].map((i) => <Skeleton key={i} className="m-3 h-5" />)
                  : jobs.map((job) => (
                      <button
                        key={job.id}
                        type="button"
                        onClick={() => selectJob(job.id)}
                        aria-current={jobId === job.id ? "page" : undefined}
                        title={job.name}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-ui hover:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                          jobId === job.id && "bg-muted",
                        )}
                      >
                        <StatusIcon
                          variant={toUiStatus(job.status, job.conclusion).kind}
                          className="shrink-0"
                        />
                        <span className="min-w-0 flex-1 truncate">{job.name}</span>
                      </button>
                    ))}
              </nav>
              <div className="mt-4 border-t border-border pt-2">
                <WorkflowFileLink owner={owner} repo={repo} run={run} />
                <a
                  href={run.html_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-3 py-2 text-caption text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="size-3.5" />
                  View on GitHub
                </a>
              </div>
            </div>
          </aside>
          <div className="min-w-0 w-full flex-1 space-y-6">
            {jobsQuery.isError ? (
              <QueryError
                title="Could not refresh jobs. Any visible jobs show the last received state."
                retry={() => {
                  void jobsQuery.refetch();
                }}
              />
            ) : null}
            {jobId ? (
              selected ? (
                <section aria-label={`Job ${selected.name}`} className="space-y-4">
                  <Button size="sm" variant="ghost" onClick={() => selectJob()}>
                    <ArrowLeft />
                    Back to summary
                  </Button>
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted p-4">
                    <div className="min-w-0">
                      <h2 className="break-words text-title font-medium">{selected.name}</h2>
                      <p className="mt-1 text-caption text-muted-foreground">
                        {selected.runner_name ||
                          (selected.status === "completed"
                            ? "No runner reported"
                            : "Waiting for a runner")}
                        {selected.labels.length ? ` · ${selected.labels.join(", ")}` : ""}
                      </p>
                    </div>
                    <StatusPill
                      variant={toUiStatus(selected.status, selected.conclusion).kind}
                      label={statusLabel(toUiStatus(selected.status, selected.conclusion))}
                    />
                  </div>
                  <JobPanel
                    key={selected.id}
                    owner={owner}
                    repo={repo}
                    job={selected}
                    defaultOpen
                  />
                </section>
              ) : jobsQuery.isPending ? (
                <JobListSkeleton />
              ) : (
                <div className="rounded-lg bg-muted p-6 text-ui">
                  <p>This job is not available in attempt {run.run_attempt}.</p>
                  <Button variant="ghost" className="mt-3" onClick={() => selectJob()}>
                    Return to summary
                  </Button>
                </div>
              )
            ) : (
              <>
                <RunOverview run={run} artifactCount={artifactsQuery.data?.length} />
                {run.status === "waiting" ||
                run.status === "action_required" ||
                run.conclusion === "action_required" ? (
                  <div role="status" className="rounded-lg bg-muted p-4 text-ui">
                    This run needs attention before it can proceed.{" "}
                    <a
                      href={run.html_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline"
                    >
                      Review on GitHub
                    </a>
                  </div>
                ) : null}
                <WorkflowFlow
                  owner={owner}
                  repo={repo}
                  run={run}
                  jobs={jobs}
                  jobsPending={jobsQuery.isPending}
                  onSelectJob={selectJob}
                />
                <section aria-label="Job results">
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="text-ui font-medium">Jobs</h2>
                    <span className="text-caption text-muted-foreground">
                      {jobsQuery.isPending
                        ? "Loading…"
                        : `${completed} of ${jobs.length} completed`}
                    </span>
                  </div>
                  {jobsQuery.isPending && <JobListSkeleton />}
                  {!jobsQuery.isPending && !jobsQuery.isError && !jobs.length ? (
                    <p className="py-6 text-ui text-muted-foreground">
                      {live
                        ? "Waiting for jobs to be scheduled…"
                        : "No jobs were reported for this attempt."}
                    </p>
                  ) : null}
                  {jobs.map((job) => (
                    <button
                      key={job.id}
                      type="button"
                      onClick={() => selectJob(job.id)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <StatusIcon
                        variant={toUiStatus(job.status, job.conclusion).kind}
                        className="shrink-0"
                      />
                      <span className="min-w-0 flex-1 truncate text-ui">{job.name}</span>
                      <span className="hidden text-caption text-muted-foreground sm:block">
                        {statusLabel(toUiStatus(job.status, job.conclusion))}
                      </span>
                      <JobDuration job={job} />
                    </button>
                  ))}
                </section>
                <section aria-label="Artifacts">
                  <h2 className="mb-2 text-ui font-medium">Artifacts</h2>
                  {artifactsQuery.isError ? (
                    <QueryError
                      title="Could not load artifacts."
                      retry={() => {
                        void artifactsQuery.refetch();
                      }}
                    />
                  ) : artifactsQuery.isPending ? (
                    <Skeleton className="h-14" />
                  ) : artifactsQuery.data.length ? (
                    <ArtifactList artifacts={artifactsQuery.data} runUrl={run.html_url} />
                  ) : (
                    <p className="py-3 text-ui text-muted-foreground">
                      {live
                        ? "Artifacts will appear as jobs upload them."
                        : "This run has no artifacts."}
                    </p>
                  )}
                </section>
              </>
            )}
          </div>
        </div>
      </Container>
    </NowTicker>
  );
}

function QueryError({ title, retry }: { title: string; retry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg bg-muted p-4 text-ui">
      <AlertCircle className="size-4 shrink-0 text-destructive" />
      <p className="flex-1">{title}</p>
      {retry ? (
        <Button size="sm" variant="ghost" onClick={retry}>
          <RefreshCw />
          Retry
        </Button>
      ) : null}
    </div>
  );
}
