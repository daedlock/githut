import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { Container } from "@/app/components/ui/Container";
import { Skeleton } from "@/app/components/ui/skeleton";
import { ArtifactList } from "@/app/features/actions/components/ArtifactList";
import { JobPanel } from "@/app/features/actions/components/JobPanel";
import { RunHeader } from "@/app/features/actions/components/RunHeader";
import {
  jobLogsQueryOptions,
  runArtifactsQueryOptions,
  runJobsQueryOptions,
  useRunArtifacts,
  useRunJobs,
  useWorkflowRun,
  workflowRunQueryOptions,
} from "@/app/features/actions/hooks";
import { isTerminal, toUiStatus } from "@/app/features/actions/lib/statusMap";
import { NowTicker } from "@/app/features/actions/lib/useNow";

export const Route = createFileRoute("/$owner/$repo/actions/runs/$runId")({
  loader: ({ context, params }) => {
    const qc = context.queryClient;
    const runId = Number(params.runId);
    if (!Number.isFinite(runId)) return;
    void qc.prefetchQuery(workflowRunQueryOptions(params.owner, params.repo, runId));
    void qc.prefetchQuery(runJobsQueryOptions(params.owner, params.repo, runId));
    void qc.prefetchQuery(runArtifactsQueryOptions(params.owner, params.repo, runId));
  },
  component: RunDetailPage,
});

function RunDetailPage() {
  const { owner, repo, runId: runIdParam } = Route.useParams();
  const runId = Number(runIdParam);
  const qc = useQueryClient();

  const runQuery = useWorkflowRun(owner, repo, runId);
  const jobsQuery = useRunJobs(owner, repo, runId);
  const artifactsQuery = useRunArtifacts(owner, repo, runId);

  const run = runQuery.data;
  const jobs = jobsQuery.data ?? [];
  const artifacts = artifactsQuery.data ?? [];

  useEffect(() => {
    if (jobs.length === 0) return;
    for (const job of jobs) {
      if (!job.started_at) continue;
      const ui = toUiStatus(job.status, job.conclusion);
      void qc.prefetchQuery(jobLogsQueryOptions(owner, repo, job.id, { isLive: !isTerminal(ui) }));
    }
  }, [qc, owner, repo, jobs]);

  if (runQuery.isPending) {
    return (
      <Container size="xl" className="max-w-5xl py-6">
        <RunDetailSkeleton />
      </Container>
    );
  }

  if (runQuery.isError || !run) {
    return (
      <Container size="xl" className="max-w-5xl py-6">
        <div className="rounded-lg bg-muted px-4 py-10 text-center">
          <AlertCircle className="mx-auto mb-2 size-5 text-destructive" aria-hidden />
          <p className="text-ui text-muted-foreground">Could not load this run.</p>
        </div>
      </Container>
    );
  }

  const runUi = toUiStatus(run.status, run.conclusion);
  const runLive = !isTerminal(runUi);

  return (
    <NowTicker enabled={runLive}>
      <Container size="xl" className="flex max-w-5xl flex-col gap-6 py-6">
        <RunHeader owner={owner} repo={repo} run={run} />

        <RunSection title="Jobs" meta={jobsQuery.isPending ? null : `${jobs.length}`}>
          {jobsQuery.isPending ? (
            <JobsSkeleton />
          ) : jobs.length === 0 ? (
            <p className="px-4 py-8 text-center font-mono text-ui text-(--color-fg-faint)">
              No jobs yet.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {jobs.map((job, i) => (
                <JobPanel
                  key={job.id}
                  owner={owner}
                  repo={repo}
                  job={job}
                  defaultOpen={i === 0 || isJobLive(job.status)}
                />
              ))}
            </div>
          )}
        </RunSection>

        {artifacts.length > 0 ? (
          <RunSection title="Artifacts" meta={String(artifacts.length)}>
            <ArtifactList artifacts={artifacts} />
          </RunSection>
        ) : null}
      </Container>
    </NowTicker>
  );
}

function isJobLive(status: string): boolean {
  return status !== "completed";
}

function RunSection({
  title,
  meta,
  children,
}: {
  title: string;
  meta: string | null;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex h-8 items-center gap-2 rounded-lg bg-muted px-3">
        <h2 className="min-w-0 truncate text-ui font-[475] text-foreground">{title}</h2>
        {meta ? (
          <span className="ml-auto font-mono text-caption tabular-nums text-muted-foreground">
            {meta}
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-1">{children}</div>
    </section>
  );
}

function RunDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4 skeleton-fade">
      <section className="flex flex-col gap-3">
        <Skeleton className="h-3 w-24" />
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 flex flex-col gap-2">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      </section>

      <div className="rounded-lg bg-muted p-3">
        <div className="flex flex-col gap-2 bg-background p-3">
          {[72, 58, 80, 46].map((w) => (
            <div key={w} className="flex items-center gap-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 flex-1" style={{ maxWidth: `${w}%` }} />
              <Skeleton className="h-3 w-10" />
            </div>
          ))}
        </div>
      </div>

      <JobsSkeleton />
    </div>
  );
}

function JobsSkeleton() {
  return (
    <div className="bg-background">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2.5">
          <Skeleton className="size-3.5 rounded-sm" />
          <Skeleton className="size-4 rounded-full" />
          <Skeleton className="h-3 flex-1" style={{ maxWidth: `${60 + i * 8}%` }} />
          <Skeleton className="h-3 w-10" />
        </div>
      ))}
    </div>
  );
}
