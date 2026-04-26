import {
  infiniteQueryOptions,
  queryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { getGitHubClient } from "@/app/lib/github/client";
import { useRepoFile } from "@/app/hooks/useRepoFile";
import { useAuthStore } from "@/app/stores/auth";
import {
  type Artifact,
  ArtifactsResponseSchema,
  type Job,
  JobsResponseSchema,
  type Workflow,
  type WorkflowRun,
  WorkflowRunSchema,
  WorkflowRunsResponseSchema,
  WorkflowsResponseSchema,
} from "./schemas";
import { parseDispatchInputs, type WorkflowDispatchSchema } from "./lib/parseDispatchInputs";
import { isTerminal, toUiStatus } from "./lib/statusMap";

// ─── Query keys ────────────────────────────────────────────────────────────

export const actionsKeys = {
  workflows: (owner: string, repo: string) => ["actions-workflows", owner, repo] as const,
  runs: (owner: string, repo: string, filters: RunsFilters) =>
    ["actions-runs", owner, repo, normalizeFilters(filters)] as const,
  run: (owner: string, repo: string, runId: number) =>
    ["actions-run", owner, repo, runId] as const,
  jobs: (owner: string, repo: string, runId: number) =>
    ["actions-jobs", owner, repo, runId] as const,
  artifacts: (owner: string, repo: string, runId: number) =>
    ["actions-artifacts", owner, repo, runId] as const,
  logs: (owner: string, repo: string, jobId: number) =>
    ["actions-logs", owner, repo, jobId] as const,
};

// ─── Filters ───────────────────────────────────────────────────────────────

export type RunsFilters = {
  workflowId?: number;
  status?: "queued" | "in_progress" | "completed" | "success" | "failure" | "cancelled";
  branch?: string;
  event?: string;
  actor?: string;
};

// Stable cache key regardless of property order.
function normalizeFilters(f: RunsFilters): string {
  const entries = Object.entries(f)
    .filter(([, v]) => v !== undefined && v !== "")
    .sort(([a], [b]) => a.localeCompare(b));
  return entries.length === 0 ? "all" : entries.map(([k, v]) => `${k}=${v}`).join("&");
}

// ─── Workflows ─────────────────────────────────────────────────────────────

export const workflowsQueryOptions = (owner: string, repo: string) =>
  queryOptions({
    queryKey: actionsKeys.workflows(owner, repo),
    // Workflows are YAML files that rarely change within a session.
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<Workflow[]> => {
      const client = getGitHubClient();
      const res = await client.request("GET /repos/{owner}/{repo}/actions/workflows", {
        owner,
        repo,
        per_page: 100,
      });
      return WorkflowsResponseSchema.parse(res.data).workflows;
    },
  });

export function useWorkflows(owner: string, repo: string) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    ...workflowsQueryOptions(owner, repo),
    enabled: !!token && !!owner && !!repo,
  });
}

// ─── Runs (infinite) ───────────────────────────────────────────────────────
//
// `useInfiniteQuery` paginates cleanly — each filter combination is its own
// cache entry (via normalizeFilters), so flipping filters cold shows the
// standard skeleton (matches Commits/Issues/Code loading language), and
// flipping back to a warmed filter is instant.
// per_page: 30 — fast first paint; pagination fills the rest on scroll.

const RUNS_PER_PAGE = 30;

export const workflowRunsQueryOptions = (
  owner: string,
  repo: string,
  filters: RunsFilters = {},
) =>
  infiniteQueryOptions({
    queryKey: actionsKeys.runs(owner, repo, filters),
    staleTime: 30_000,
    initialPageParam: 1,
    getNextPageParam: (lastPage: WorkflowRun[], _all, lastPageParam) =>
      lastPage.length < RUNS_PER_PAGE ? undefined : (lastPageParam as number) + 1,
    queryFn: async ({ pageParam }): Promise<WorkflowRun[]> => {
      const client = getGitHubClient();
      const base = {
        owner,
        repo,
        per_page: RUNS_PER_PAGE,
        page: pageParam as number,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.branch ? { branch: filters.branch } : {}),
        ...(filters.event ? { event: filters.event } : {}),
        ...(filters.actor ? { actor: filters.actor } : {}),
      } as const;
      const res = filters.workflowId
        ? await client.request(
            "GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs",
            { ...base, workflow_id: filters.workflowId },
          )
        : await client.request("GET /repos/{owner}/{repo}/actions/runs", base);
      return WorkflowRunsResponseSchema.parse(res.data).workflow_runs;
    },
  });

export function useWorkflowRuns(owner: string, repo: string, filters: RunsFilters = {}) {
  const token = useAuthStore((s) => s.token);
  return useInfiniteQuery({
    ...workflowRunsQueryOptions(owner, repo, filters),
    enabled: !!token && !!owner && !!repo,
  });
}

// ─── Run detail ────────────────────────────────────────────────────────────
//
// A single run's metadata. Polls when the run is non-terminal so "queued"
// → "running" → "completed" transitions flow in without a refresh.

export const workflowRunQueryOptions = (owner: string, repo: string, runId: number) =>
  queryOptions({
    queryKey: actionsKeys.run(owner, repo, runId),
    staleTime: 15_000,
    queryFn: async (): Promise<WorkflowRun> => {
      const client = getGitHubClient();
      const res = await client.request("GET /repos/{owner}/{repo}/actions/runs/{run_id}", {
        owner,
        repo,
        run_id: runId,
      });
      return WorkflowRunSchema.parse(res.data);
    },
  });

export function useWorkflowRun(owner: string, repo: string, runId: number) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    ...workflowRunQueryOptions(owner, repo, runId),
    enabled: !!token && !!owner && !!repo && Number.isFinite(runId),
    // Poll only while the run is alive — completed runs are immutable.
    // Pause when the tab is hidden to save rate limit + battery.
    refetchInterval: (q) => {
      const run = q.state.data;
      if (!run) return false;
      const ui = toUiStatus(run.status, run.conclusion);
      return isTerminal(ui) ? false : 3_000;
    },
    refetchIntervalInBackground: false,
  });
}

// ─── Jobs for a run ────────────────────────────────────────────────────────

export const runJobsQueryOptions = (owner: string, repo: string, runId: number) =>
  queryOptions({
    queryKey: actionsKeys.jobs(owner, repo, runId),
    staleTime: 10_000,
    queryFn: async (): Promise<Job[]> => {
      const client = getGitHubClient();
      const res = await client.request(
        "GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs",
        { owner, repo, run_id: runId, per_page: 100 },
      );
      return JobsResponseSchema.parse(res.data).jobs;
    },
  });

export function useRunJobs(owner: string, repo: string, runId: number) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    ...runJobsQueryOptions(owner, repo, runId),
    enabled: !!token && !!owner && !!repo && Number.isFinite(runId),
    refetchInterval: (q) => {
      const jobs = q.state.data;
      // Empty array = post-rerun optimistic clear, or just-queued run with
      // no jobs assigned yet. Keep polling so new jobs appear as they get
      // scheduled.
      if (!jobs || jobs.length === 0) return 3_000;
      const anyLive = jobs.some((j) => {
        const ui = toUiStatus(j.status, j.conclusion);
        return !isTerminal(ui);
      });
      return anyLive ? 3_000 : false;
    },
    refetchIntervalInBackground: false,
  });
}

// ─── Single job by ID ─────────────────────────────────────────────────────

import { JobSchema } from "./schemas";

export function useJob(owner: string, repo: string, jobId: number) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ["actions-job", owner, repo, jobId] as const,
    staleTime: 30_000,
    enabled: !!token && !!owner && !!repo && Number.isFinite(jobId) && jobId > 0,
    queryFn: async (): Promise<Job> => {
      const client = getGitHubClient();
      const res = await client.request(
        "GET /repos/{owner}/{repo}/actions/jobs/{job_id}",
        { owner, repo, job_id: jobId },
      );
      return JobSchema.parse(res.data);
    },
  });
}

// ─── Artifacts for a run ───────────────────────────────────────────────────

export const runArtifactsQueryOptions = (owner: string, repo: string, runId: number) =>
  queryOptions({
    queryKey: actionsKeys.artifacts(owner, repo, runId),
    // Artifacts are immutable once a run completes; short stale while the
    // run might still be uploading them.
    staleTime: 30_000,
    queryFn: async (): Promise<Artifact[]> => {
      const client = getGitHubClient();
      const res = await client.request(
        "GET /repos/{owner}/{repo}/actions/runs/{run_id}/artifacts",
        { owner, repo, run_id: runId, per_page: 100 },
      );
      return ArtifactsResponseSchema.parse(res.data).artifacts;
    },
  });

export function useRunArtifacts(owner: string, repo: string, runId: number) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    ...runArtifactsQueryOptions(owner, repo, runId),
    enabled: !!token && !!owner && !!repo && Number.isFinite(runId),
  });
}

// ─── Job logs ──────────────────────────────────────────────────────────────
//
// Fetches plaintext logs via the Worker proxy (`/api/actions/jobs/:id/logs`)
// — GitHub's direct endpoint redirects to an Azure Blob URL that doesn't
// serve CORS, so the browser can't call it directly.
//
// Logs for a completed job are immutable, so staleTime goes to Infinity.
// Live jobs are polled every 3s (tied to `isLive`) so the viewer can tail.

export const jobLogsQueryOptions = (
  owner: string,
  repo: string,
  jobId: number,
  { isLive = false }: { isLive?: boolean } = {},
) =>
  queryOptions({
    queryKey: actionsKeys.logs(owner, repo, jobId),
    staleTime: isLive ? 0 : Infinity,
    gcTime: 10 * 60_000,
    retry: false,
    queryFn: async (): Promise<string> => {
      const token = useAuthStore.getState().token;
      if (!token) throw new Error("Not authenticated");
      const url = `/api/actions/jobs/${jobId}/logs?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        // Surface the status + the Worker's passthrough `detail` field so
        // consumers can render scoped errors and devs can see Azure's
        // actual complaint during transient upstream failures.
        let detail: string | undefined;
        try {
          const body = (await res.json()) as { detail?: string };
          detail = body.detail;
        } catch {
          // body wasn't JSON — ignore.
        }
        const err = new Error(`Logs fetch failed: ${res.status}`) as Error & {
          status: number;
          detail?: string;
        };
        err.status = res.status;
        err.detail = detail;
        throw err;
      }
      return await res.text();
    },
  });

export function useJobLogs(
  owner: string,
  repo: string,
  jobId: number,
  opts: { isLive?: boolean; enabled?: boolean } = {},
) {
  const token = useAuthStore((s) => s.token);
  const { isLive = false, enabled = true } = opts;
  return useQuery({
    ...jobLogsQueryOptions(owner, repo, jobId, { isLive }),
    enabled: enabled && !!token && !!owner && !!repo && Number.isFinite(jobId),
    refetchInterval: isLive ? 3_000 : false,
    refetchIntervalInBackground: false,
  });
}

// ─── Mutations: rerun / rerun-failed / cancel ─────────────────────────────
//
// Optimistic pattern mirrors `useUpdateIssueState`: flip the cached run into
// the post-mutation state synchronously so the UI feels instant, then let
// background polling reconcile with the server. Errors roll back via
// `onError`. All three invalidate run + jobs + runs-list on settle so the
// other surfaces (detail, list, sub-tabs) converge without page refresh.

function optimisticRerun(
  qc: ReturnType<typeof useQueryClient>,
  owner: string,
  repo: string,
  runId: number,
) {
  const key = actionsKeys.run(owner, repo, runId);
  qc.cancelQueries({ queryKey: key });
  const prev = qc.getQueryData<WorkflowRun>(key);
  if (prev) {
    qc.setQueryData<WorkflowRun>(key, {
      ...prev,
      // Flip to queued; polling will reconcile attempt number + timestamps
      // with truth. We intentionally don't bump run_attempt here — the real
      // value from GitHub is load-bearing elsewhere and pre-flipping it
      // caused users to see "attempt N" before GitHub acknowledged.
      status: "queued",
      conclusion: null,
      updated_at: new Date().toISOString(),
      run_started_at: undefined,
    });
  }
  return { prev, key };
}

// For rerun-style mutations: delayed invalidation. GitHub's backend takes
// up to ~2 s to propagate a rerun, and an immediate refetch would return
// the *old* completed state, flickering over the optimistic "queued" flip
// and making the button feel dead. The delay lets polling take over
// naturally once truth matches optimism.
function invalidateAfterRerun(
  qc: ReturnType<typeof useQueryClient>,
  owner: string,
  repo: string,
  runId: number,
) {
  // Runs list can refresh immediately — it doesn't have optimistic state
  // to protect and the list item's status lags behind by design.
  qc.invalidateQueries({ queryKey: ["actions-runs", owner, repo] });
  // Run + jobs + artifacts delayed so GitHub has time to propagate.
  window.setTimeout(() => {
    qc.invalidateQueries({ queryKey: actionsKeys.run(owner, repo, runId) });
    qc.invalidateQueries({ queryKey: actionsKeys.jobs(owner, repo, runId) });
    qc.invalidateQueries({ queryKey: actionsKeys.artifacts(owner, repo, runId) });
  }, 2500);
}

function invalidateAfterCancel(
  qc: ReturnType<typeof useQueryClient>,
  owner: string,
  repo: string,
  runId: number,
) {
  qc.invalidateQueries({ queryKey: actionsKeys.run(owner, repo, runId) });
  qc.invalidateQueries({ queryKey: actionsKeys.jobs(owner, repo, runId) });
  qc.invalidateQueries({ queryKey: actionsKeys.artifacts(owner, repo, runId) });
  qc.invalidateQueries({ queryKey: ["actions-runs", owner, repo] });
}

// Context shape returned from onMutate for rerun mutations — lets onError
// roll back both the run state AND the optimistically-cleared jobs list.
type RerunCtx = {
  prev?: WorkflowRun;
  key: readonly unknown[];
  jobsKey: readonly unknown[];
  prevJobs?: Job[];
};

function optimisticRerunAndClearJobs(
  qc: ReturnType<typeof useQueryClient>,
  owner: string,
  repo: string,
  runId: number,
): RerunCtx {
  const base = optimisticRerun(qc, owner, repo, runId);
  // Clear jobs so stale "all jobs succeeded" state doesn't contradict the
  // optimistically-queued run. Polling will repopulate with the new
  // attempt's jobs once GitHub propagates.
  const jobsKey = actionsKeys.jobs(owner, repo, runId);
  const prevJobs = qc.getQueryData<Job[]>(jobsKey);
  qc.setQueryData<Job[]>(jobsKey, []);
  return { ...base, jobsKey, prevJobs };
}

function rollbackRerun(
  qc: ReturnType<typeof useQueryClient>,
  ctx: RerunCtx | undefined,
) {
  if (!ctx) return;
  if (ctx.prev) qc.setQueryData(ctx.key, ctx.prev);
  if (ctx.prevJobs !== undefined) qc.setQueryData(ctx.jobsKey, ctx.prevJobs);
}

export function useRerunRun(owner: string, repo: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (runId: number) => {
      const client = getGitHubClient();
      await client.request("POST /repos/{owner}/{repo}/actions/runs/{run_id}/rerun", {
        owner,
        repo,
        run_id: runId,
      });
    },
    onMutate: (runId) => optimisticRerunAndClearJobs(qc, owner, repo, runId),
    onError: (_err, _runId, ctx) => rollbackRerun(qc, ctx),
    onSuccess: (_data, runId) => invalidateAfterRerun(qc, owner, repo, runId),
  });
}

export function useRerunFailedJobs(owner: string, repo: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (runId: number) => {
      const client = getGitHubClient();
      await client.request(
        "POST /repos/{owner}/{repo}/actions/runs/{run_id}/rerun-failed-jobs",
        { owner, repo, run_id: runId },
      );
    },
    onMutate: (runId) => optimisticRerunAndClearJobs(qc, owner, repo, runId),
    onError: (_err, _runId, ctx) => rollbackRerun(qc, ctx),
    onSuccess: (_data, runId) => invalidateAfterRerun(qc, owner, repo, runId),
  });
}

export function useCancelRun(owner: string, repo: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (runId: number) => {
      const client = getGitHubClient();
      await client.request("POST /repos/{owner}/{repo}/actions/runs/{run_id}/cancel", {
        owner,
        repo,
        run_id: runId,
      });
    },
    // No optimistic flip — GitHub has no "cancelling" status, and flipping
    // to "completed/cancelled" would stop our polling. Let polling reveal
    // the transition ("in_progress" → "completed/cancelled") naturally.
    onSettled: (_data, _err, runId) => invalidateAfterCancel(qc, owner, repo, runId),
  });
}

// ─── Workflow dispatch ─────────────────────────────────────────────────────
//
// Given a workflow's file path (e.g. `.github/workflows/deploy.yml`), fetch
// the raw YAML and parse just the `on.workflow_dispatch` section. Reuses
// our existing `useRepoFile` hook so the content lands in its cache and
// stays immutable when pinned to a SHA.

/**
 * Fetch and parse a workflow's dispatch schema. Returns `null` while loading
 * or if the path is empty; the caller renders a "Run workflow" button only
 * when `schema.dispatchable` is true.
 */
export function useWorkflowDispatchSchema(
  owner: string,
  repo: string,
  path: string | undefined,
) {
  const file = useRepoFile(owner, repo, path ?? "");
  const schema: WorkflowDispatchSchema | null = file.data
    ? parseDispatchInputs(file.data.content)
    : null;
  return {
    schema,
    isPending: file.isPending,
    isError: file.isError,
  };
}

/**
 * POST /workflows/{id}/dispatches. Response is 204 No Content — there's no
 * new run id to return. After success we invalidate the runs list so the
 * freshly-queued run appears at the top.
 */
export function useDispatchWorkflow(owner: string, repo: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      workflowId: number;
      ref: string;
      inputs?: Record<string, string | boolean | number>;
    }) => {
      const client = getGitHubClient();
      await client.request(
        "POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches",
        {
          owner,
          repo,
          workflow_id: vars.workflowId,
          ref: vars.ref,
          inputs: vars.inputs
            ? // GitHub only accepts string inputs in the request body. Boolean
              // + number types get coerced by the runner at eval time.
              Object.fromEntries(Object.entries(vars.inputs).map(([k, v]) => [k, String(v)]))
            : undefined,
        },
      );
    },
    onSuccess: () => {
      // New run appears at the top of the runs list within a few seconds.
      qc.invalidateQueries({ queryKey: ["actions-runs", owner, repo] });
    },
  });
}
