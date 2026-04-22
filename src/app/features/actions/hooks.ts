import { queryOptions, useQuery } from "@tanstack/react-query";
import { getGitHubClient } from "@/app/lib/github/client";
import { useAuthStore } from "@/app/stores/auth";
import {
  type Workflow,
  type WorkflowRun,
  WorkflowRunsResponseSchema,
  WorkflowsResponseSchema,
} from "./schemas";

// ─── Query keys ────────────────────────────────────────────────────────────

export const actionsKeys = {
  workflows: (owner: string, repo: string) => ["actions-workflows", owner, repo] as const,
  runs: (owner: string, repo: string, filters: RunsFilters) =>
    ["actions-runs", owner, repo, normalizeFilters(filters)] as const,
};

// ─── Filters ───────────────────────────────────────────────────────────────
//
// Mirrors the filter knobs GitHub's Actions tab exposes. Stored in the URL
// (search params) so deep links preserve them and back/forward work.

export type RunsFilters = {
  workflowId?: number;
  status?: "queued" | "in_progress" | "completed" | "success" | "failure" | "cancelled";
  branch?: string;
  event?: string;
  actor?: string;
};

// Stable cache key regardless of object property order.
function normalizeFilters(f: RunsFilters): string {
  const entries = Object.entries(f)
    .filter(([, v]) => v !== undefined && v !== "")
    .sort(([a], [b]) => a.localeCompare(b));
  return entries.length === 0 ? "all" : entries.map(([k, v]) => `${k}=${v}`).join("&");
}

// ─── Query options ─────────────────────────────────────────────────────────

export const workflowsQueryOptions = (owner: string, repo: string) =>
  queryOptions({
    queryKey: actionsKeys.workflows(owner, repo),
    // Workflows are a YAML file; they barely change. 10min is plenty for a
    // session without feeling stale when someone adds a new workflow.
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

export const workflowRunsQueryOptions = (
  owner: string,
  repo: string,
  filters: RunsFilters = {},
) =>
  queryOptions({
    queryKey: actionsKeys.runs(owner, repo, filters),
    // Shorter stale than workflows — a terminal run won't change, but new
    // runs appear often. The infinite-staleTime cached bodies come from ETag.
    staleTime: 30_000,
    queryFn: async (): Promise<WorkflowRun[]> => {
      const client = getGitHubClient();
      const params = {
        owner,
        repo,
        per_page: 30,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.branch ? { branch: filters.branch } : {}),
        ...(filters.event ? { event: filters.event } : {}),
        ...(filters.actor ? { actor: filters.actor } : {}),
      } as const;
      const res = filters.workflowId
        ? await client.request(
            "GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs",
            { ...params, workflow_id: filters.workflowId },
          )
        : await client.request("GET /repos/{owner}/{repo}/actions/runs", params);
      return WorkflowRunsResponseSchema.parse(res.data).workflow_runs;
    },
  });

// ─── Hooks ─────────────────────────────────────────────────────────────────

export function useWorkflows(owner: string, repo: string) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    ...workflowsQueryOptions(owner, repo),
    enabled: !!token && !!owner && !!repo,
  });
}

export function useWorkflowRuns(owner: string, repo: string, filters: RunsFilters = {}) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    ...workflowRunsQueryOptions(owner, repo, filters),
    enabled: !!token && !!owner && !!repo,
  });
}
