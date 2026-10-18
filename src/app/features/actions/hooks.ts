import {
  infiniteQueryOptions,
  queryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { useRepoFile } from "@/app/hooks/useRepoFile";
import { useLiveInterval } from "@/app/lib/freshness";
import { getGitHubClient } from "@/app/lib/github/client";
import { retrySessionExpiry } from "@/app/lib/query";
import { useAuthStore } from "@/app/stores/auth";
import { parseDispatchInputs } from "./lib/parseDispatchInputs";
import {
  type Artifact,
  ArtifactsResponseSchema,
  type Job,
  JobSchema,
  JobsResponseSchema,
  type Workflow,
  type WorkflowRun,
  WorkflowRunSchema,
  WorkflowRunsResponseSchema,
  WorkflowsResponseSchema,
} from "./schemas";

export const actionsKeys = {
  workflows: (owner: string, repo: string) => ["actions-workflows", owner, repo] as const,
  runs: (owner: string, repo: string, filters: RunsFilters) =>
    ["actions-runs", owner, repo, filters] as const,
  run: (owner: string, repo: string, runId: number) => ["actions-run", owner, repo, runId] as const,
  jobs: (owner: string, repo: string, runId: number, attempt?: number) =>
    ["actions-jobs", owner, repo, runId, ...(attempt ? [attempt] : [])] as const,
  artifacts: (owner: string, repo: string, runId: number) =>
    ["actions-artifacts", owner, repo, runId] as const,
  logs: (owner: string, repo: string, jobId: number) =>
    ["actions-logs", owner, repo, jobId] as const,
};

export const RUN_STATUSES = [
  "queued",
  "in_progress",
  "waiting",
  "pending",
  "completed",
  "success",
  "failure",
  "cancelled",
  "skipped",
  "timed_out",
  "action_required",
  "neutral",
  "stale",
  "requested",
] as const;
export type RunsFilters = {
  workflowId?: number;
  status?: (typeof RUN_STATUSES)[number];
  branch?: string;
  event?: string;
  actor?: string;
};
const validId = (id: number) => Number.isSafeInteger(id) && id > 0;
const retry = (count: number, error: unknown) =>
  count < 2 && ![403, 404, 422, 429].includes((error as { status?: number })?.status ?? 0);
const requestOptions = { retry };

export const workflowsQueryOptions = (owner: string, repo: string) =>
  queryOptions({
    ...requestOptions,
    queryKey: actionsKeys.workflows(owner, repo),
    staleTime: 10 * 60_000,
    queryFn: async ({ signal }): Promise<Workflow[]> => {
      const workflows: Workflow[] = [];
      for (let page = 1; ; page++) {
        const res = await getGitHubClient().request("GET /repos/{owner}/{repo}/actions/workflows", {
          owner,
          repo,
          per_page: 100,
          page,
          request: { signal },
        });
        const data = WorkflowsResponseSchema.parse(res.data);
        workflows.push(...data.workflows);
        if (data.workflows.length < 100 || workflows.length >= data.total_count) return workflows;
      }
    },
  });
export function useWorkflows(owner: string, repo: string) {
  const token = useAuthStore((s) => s.token);
  return useQuery({ ...workflowsQueryOptions(owner, repo), enabled: !!token && !!owner && !!repo });
}

const RUNS_PER_PAGE = 30;
export const workflowRunsQueryOptions = (owner: string, repo: string, filters: RunsFilters = {}) =>
  infiniteQueryOptions({
    ...requestOptions,
    queryKey: actionsKeys.runs(owner, repo, filters),
    staleTime: 10_000,
    initialPageParam: 1,
    getNextPageParam: (lastPage: WorkflowRun[], _all, lastPageParam) =>
      lastPage.length < RUNS_PER_PAGE ? undefined : lastPageParam + 1,
    queryFn: async ({ pageParam, signal }): Promise<WorkflowRun[]> => {
      const { workflowId, ...rest } = filters;
      const base = {
        owner,
        repo,
        ...rest,
        per_page: RUNS_PER_PAGE,
        page: pageParam,
        request: { signal },
      };
      const client = getGitHubClient();
      const res = workflowId
        ? await client.request("GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs", {
            ...base,
            workflow_id: workflowId,
          })
        : await client.request("GET /repos/{owner}/{repo}/actions/runs", base);
      return WorkflowRunsResponseSchema.parse(res.data).workflow_runs;
    },
  });
export function useWorkflowRuns(owner: string, repo: string, filters: RunsFilters = {}) {
  const token = useAuthStore((s) => s.token);
  const live = useLiveInterval();
  return useInfiniteQuery({
    ...workflowRunsQueryOptions(owner, repo, filters),
    enabled: !!token && !!owner && !!repo,
    // Idle lists also refresh so newly dispatched runs can appear. Only the
    // first page polls: refetching re-reads every loaded page.
    refetchInterval: (q) => {
      const pages = q.state.data?.pages ?? [];
      if (pages.length > 1) return false;
      return pages.some((page) => page.some((run) => run.status !== "completed"))
        ? live("ci", 5_000)
        : live("changing", 30_000);
    },
  });
}

export const workflowRunQueryOptions = (owner: string, repo: string, runId: number) =>
  queryOptions({
    ...requestOptions,
    queryKey: actionsKeys.run(owner, repo, runId),
    staleTime: 5_000,
    queryFn: async ({ signal }): Promise<WorkflowRun> => {
      const res = await getGitHubClient().request(
        "GET /repos/{owner}/{repo}/actions/runs/{run_id}",
        {
          owner,
          repo,
          run_id: runId,
          request: { signal },
        },
      );
      return WorkflowRunSchema.parse(res.data);
    },
  });
export function useWorkflowRun(owner: string, repo: string, runId: number) {
  const token = useAuthStore((s) => s.token);
  const live = useLiveInterval();
  return useQuery({
    ...workflowRunQueryOptions(owner, repo, runId),
    enabled: !!token && !!owner && !!repo && validId(runId),
    // A finished run still refreshes at the tab's cadence so a rerun started
    // elsewhere (or still propagating) shows up.
    refetchInterval: (q) =>
      live(q.state.data && q.state.data.status !== "completed" ? "ci" : "changing"),
  });
}

export const runJobsQueryOptions = (owner: string, repo: string, runId: number, attempt?: number) =>
  queryOptions({
    ...requestOptions,
    queryKey: actionsKeys.jobs(owner, repo, runId, attempt),
    staleTime: 5_000,
    queryFn: async ({ signal }): Promise<Job[]> => {
      const jobs: Job[] = [];
      for (let page = 1; ; page++) {
        const base = { owner, repo, run_id: runId, per_page: 100, page, request: { signal } };
        const client = getGitHubClient();
        const res = attempt
          ? await client.request(
              "GET /repos/{owner}/{repo}/actions/runs/{run_id}/attempts/{attempt_number}/jobs",
              {
                ...base,
                attempt_number: attempt,
              },
            )
          : await client.request("GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs", {
              ...base,
              filter: "latest",
            });
        const data = JobsResponseSchema.parse(res.data);
        jobs.push(...data.jobs);
        if (data.jobs.length < 100 || jobs.length >= data.total_count) return jobs;
      }
    },
  });
export function useRunJobs(owner: string, repo: string, runId: number, run?: WorkflowRun) {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  const attempt = run?.run_attempt;
  const status = run?.status;
  const live = useLiveInterval();
  // Reconcile once on completion even if a jobs response briefly trails run metadata.
  useEffect(() => {
    if (status === "completed")
      void qc.invalidateQueries({ queryKey: actionsKeys.jobs(owner, repo, runId, attempt) });
  }, [qc, owner, repo, runId, attempt, status]);
  return useQuery({
    ...runJobsQueryOptions(owner, repo, runId, attempt),
    enabled: !!token && validId(runId) && !!run,
    refetchInterval: (q) =>
      live(
        (status !== "completed" || !!q.state.data?.some((j) => j.status !== "completed")) && "ci",
      ),
  });
}

export function useJob(owner: string, repo: string, jobId: number) {
  const token = useAuthStore((s) => s.token);
  const live = useLiveInterval();
  return useQuery({
    ...requestOptions,
    queryKey: ["actions-job", owner, repo, jobId],
    staleTime: 10_000,
    enabled: !!token && !!owner && !!repo && validId(jobId),
    queryFn: async ({ signal }): Promise<Job> => {
      const res = await getGitHubClient().request(
        "GET /repos/{owner}/{repo}/actions/jobs/{job_id}",
        {
          owner,
          repo,
          job_id: jobId,
          request: { signal },
        },
      );
      return JobSchema.parse(res.data);
    },
    refetchInterval: (q) => live(!!q.state.data && q.state.data.status !== "completed" && "ci"),
  });
}

export const runArtifactsQueryOptions = (owner: string, repo: string, runId: number) =>
  queryOptions({
    ...requestOptions,
    queryKey: actionsKeys.artifacts(owner, repo, runId),
    staleTime: 30_000,
    queryFn: async ({ signal }): Promise<Artifact[]> => {
      const artifacts: Artifact[] = [];
      for (let page = 1; ; page++) {
        const res = await getGitHubClient().request(
          "GET /repos/{owner}/{repo}/actions/runs/{run_id}/artifacts",
          {
            owner,
            repo,
            run_id: runId,
            per_page: 100,
            page,
            request: { signal },
          },
        );
        const data = ArtifactsResponseSchema.parse(res.data);
        artifacts.push(...data.artifacts);
        if (data.artifacts.length < 100 || artifacts.length >= data.total_count) return artifacts;
      }
    },
  });
export function useRunArtifacts(owner: string, repo: string, runId: number, run?: WorkflowRun) {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  const status = run?.status;
  const attempt = run?.run_attempt;
  const live = useLiveInterval();
  useEffect(() => {
    if (status === "completed" && attempt)
      void qc.invalidateQueries({ queryKey: actionsKeys.artifacts(owner, repo, runId) });
  }, [qc, owner, repo, runId, status, attempt]);
  return useQuery({
    ...runArtifactsQueryOptions(owner, repo, runId),
    enabled: !!token && validId(runId) && !!run,
    refetchInterval: live(!!status && status !== "completed" && "ci", 10_000),
  });
}

export const jobLogsQueryOptions = (
  owner: string,
  repo: string,
  jobId: number,
  { isLive = false, pollUntil }: { isLive?: boolean; pollUntil?: number } = {},
) =>
  queryOptions<string>({
    queryKey: actionsKeys.logs(owner, repo, jobId),
    staleTime: isLive ? 0 : Infinity,
    gcTime: 10 * 60_000,
    retry: retrySessionExpiry,
    refetchInterval: (q) => {
      const status = (q.state.error as { status?: number } | null)?.status;
      if (status === 401 || status === 403 || status === 410 || status === 429) return false;
      if (isLive) return 5_000;
      return pollUntil &&
        Date.now() < pollUntil &&
        (!q.state.data || q.state.isInvalidated || q.state.status === "error")
        ? 3_000
        : false;
    },
    queryFn: async ({ signal }): Promise<string> => {
      const token = useAuthStore.getState().token;
      if (!token) throw new Error("Not authenticated");
      const res = await fetch(
        `/api/actions/jobs/${jobId}/logs?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal,
        },
      );
      if (res.status === 401 && useAuthStore.getState().token === token)
        useAuthStore.getState().markExpired();
      if (!res.ok)
        throw Object.assign(new Error(`Could not load logs (${res.status}).`), {
          status: res.status,
        });
      return res.text();
    },
  });
export function useJobLogs(
  owner: string,
  repo: string,
  jobId: number,
  {
    isLive = false,
    enabled = true,
    pollUntil,
  }: { isLive?: boolean; enabled?: boolean; pollUntil?: number } = {},
) {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  // A final download is required even when a partial live log is cached forever.
  useEffect(() => {
    if (enabled && !isLive)
      void qc.invalidateQueries({ queryKey: actionsKeys.logs(owner, repo, jobId) });
  }, [qc, owner, repo, jobId, enabled, isLive]);
  return useQuery({
    ...jobLogsQueryOptions(owner, repo, jobId, { isLive, pollUntil }),
    enabled: enabled && !!token && validId(jobId),
  });
}

type RunCommand = "rerun" | "rerun-failed-jobs" | "cancel";
function useRunCommand(owner: string, repo: string, command: RunCommand) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["actions-command", owner, repo],
    mutationFn: async (runId: number) => {
      await getGitHubClient().request(
        `POST /repos/{owner}/{repo}/actions/runs/{run_id}/${command}`,
        {
          owner,
          repo,
          run_id: runId,
        },
      );
    },
    onSuccess: async (_, runId) => {
      // Reconcile the accepted command; the run's live polling follows
      // propagation. A detached polling loop would keep fetching hidden tabs.
      await Promise.all([
        qc.invalidateQueries({ queryKey: actionsKeys.run(owner, repo, runId) }),
        qc.invalidateQueries({ queryKey: actionsKeys.jobs(owner, repo, runId) }),
        qc.invalidateQueries({ queryKey: actionsKeys.artifacts(owner, repo, runId) }),
        qc.invalidateQueries({ queryKey: ["actions-runs", owner, repo] }),
      ]);
    },
  });
}
export const useRerunRun = (owner: string, repo: string) => useRunCommand(owner, repo, "rerun");
export const useRerunFailedJobs = (owner: string, repo: string) =>
  useRunCommand(owner, repo, "rerun-failed-jobs");
export const useCancelRun = (owner: string, repo: string) => useRunCommand(owner, repo, "cancel");

export function useWorkflowDispatchSchema(owner: string, repo: string, path: string | undefined) {
  const file = useRepoFile(owner, repo, path ?? "");
  const schema = useMemo(
    () => (file.data ? parseDispatchInputs(file.data.content) : null),
    [file.data],
  );
  return { schema, isPending: file.isPending, isError: file.isError };
}
export function useDispatchWorkflow(owner: string, repo: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      workflowId: number;
      ref: string;
      inputs?: Record<string, string | boolean | number>;
    }) => {
      await getGitHubClient().request(
        "POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches",
        {
          owner,
          repo,
          workflow_id: vars.workflowId,
          ref: vars.ref,
          inputs: vars.inputs
            ? Object.fromEntries(Object.entries(vars.inputs).map(([k, v]) => [k, String(v)]))
            : undefined,
        },
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["actions-runs", owner, repo] });
    },
  });
}
