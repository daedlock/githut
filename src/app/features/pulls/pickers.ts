import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { z } from "zod";
import { getGitHubClient } from "@/app/lib/github/client";
import { pullsKeys } from "@/app/features/pulls/hooks";
import { PullRequestSchema, type PullRequest } from "@/app/features/pulls/schemas";
import { useAuthStore } from "@/app/stores/auth";

// ─── Data sources ──────────────────────────────────────────────────────────
//
// Repo-wide lists fed into the sidebar pickers. Cached 5 min — these
// rarely churn during a review session. Each is invalidated by its own
// key so mutations can resync just the slice that changed.

const RepoLabelSchema = z.object({
  id: z.number(),
  name: z.string(),
  color: z.string(),
  description: z.string().nullable().optional(),
});
export type RepoLabel = z.infer<typeof RepoLabelSchema>;

const RepoLabelsResponseSchema = z.array(RepoLabelSchema);

const CollaboratorSchema = z.object({
  id: z.number(),
  login: z.string(),
  avatar_url: z.string(),
  type: z.string().optional(),
});
export type Collaborator = z.infer<typeof CollaboratorSchema>;

const CollaboratorsResponseSchema = z.array(CollaboratorSchema);

export const repoLabelsKey = (owner: string, repo: string) =>
  ["repo-labels", owner, repo] as const;

export const repoCollaboratorsKey = (owner: string, repo: string) =>
  ["repo-collaborators", owner, repo] as const;

export const repoLabelsQueryOptions = (owner: string, repo: string) =>
  queryOptions({
    queryKey: repoLabelsKey(owner, repo),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<RepoLabel[]> => {
      const client = getGitHubClient();
      const res = await client.request("GET /repos/{owner}/{repo}/labels", {
        owner,
        repo,
        per_page: 100,
      });
      return RepoLabelsResponseSchema.parse(res.data);
    },
  });

export function useRepoLabels(owner: string, repo: string) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    ...repoLabelsQueryOptions(owner, repo),
    enabled: !!token && !!owner && !!repo,
  });
}

export const repoCollaboratorsQueryOptions = (owner: string, repo: string) =>
  queryOptions({
    queryKey: repoCollaboratorsKey(owner, repo),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Collaborator[]> => {
      const client = getGitHubClient();
      const res = await client.request(
        "GET /repos/{owner}/{repo}/collaborators",
        { owner, repo, per_page: 100, affiliation: "all" },
      );
      return CollaboratorsResponseSchema.parse(res.data);
    },
  });

export function useRepoCollaborators(owner: string, repo: string) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    ...repoCollaboratorsQueryOptions(owner, repo),
    enabled: !!token && !!owner && !!repo,
  });
}

// ─── Mutations ─────────────────────────────────────────────────────────────
//
// Every mutation below writes through the PR detail cache optimistically
// so the sidebar reflects the toggle before the network round-trip
// returns. Rollback on error restores the snapshot; on settle we quietly
// invalidate so the server shape is the source of truth eventually.
//
// Pattern: snapshot → optimistic write → swap on success → invalidate on
// settle. Mirrors the Issues-feature mutation style.

function patchPrDetail(
  queryClient: ReturnType<typeof useQueryClient>,
  owner: string,
  repo: string,
  number: number,
  mutator: (pr: PullRequest) => PullRequest,
) {
  const key = pullsKeys.detail(owner, repo, number);
  const prev = queryClient.getQueryData<PullRequest>(key);
  if (prev) queryClient.setQueryData<PullRequest>(key, mutator(prev));
  return { key, prev };
}

// ─── Assignees ─────────────────────────────────────────────────────────────

export function useSetPrAssignees(owner: string, repo: string, number: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      add,
      remove,
    }: {
      add: string[];
      remove: string[];
    }) => {
      const client = getGitHubClient();
      if (add.length > 0) {
        const res = await client.request(
          "POST /repos/{owner}/{repo}/issues/{issue_number}/assignees",
          { owner, repo, issue_number: number, assignees: add },
        );
        return PullRequestSchema.parse(res.data);
      }
      if (remove.length > 0) {
        const res = await client.request(
          "DELETE /repos/{owner}/{repo}/issues/{issue_number}/assignees",
          { owner, repo, issue_number: number, assignees: remove },
        );
        return PullRequestSchema.parse(res.data);
      }
      return null;
    },
    onMutate: async ({ add, remove }) => {
      await queryClient.cancelQueries({
        queryKey: pullsKeys.detail(owner, repo, number),
      });
      return patchPrDetail(queryClient, owner, repo, number, (pr) => ({
        ...pr,
        assignees: [
          ...pr.assignees.filter((a) => !remove.includes(a.login)),
          ...add
            .filter((login) => !pr.assignees.some((a) => a.login === login))
            .map((login) => ({ login, avatar_url: `https://github.com/${login}.png` })),
        ],
      }));
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(ctx.key, ctx.prev);
    },
    onSuccess: (updated) => {
      // Use server response to update cache
      if (updated) {
        queryClient.setQueryData(pullsKeys.detail(owner, repo, number), updated);
      }
    },
  });
}

// ─── Requested reviewers ───────────────────────────────────────────────────

export function useSetPrReviewers(owner: string, repo: string, number: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      add,
      remove,
    }: {
      add: string[];
      remove: string[];
    }) => {
      const client = getGitHubClient();
      if (add.length > 0) {
        const res = await client.request(
          "POST /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers",
          { owner, repo, pull_number: number, reviewers: add },
        );
        return PullRequestSchema.parse(res.data);
      }
      if (remove.length > 0) {
        const res = await client.request(
          "DELETE /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers",
          { owner, repo, pull_number: number, reviewers: remove },
        );
        return PullRequestSchema.parse(res.data);
      }
      return null;
    },
    onMutate: async ({ add, remove }) => {
      await queryClient.cancelQueries({
        queryKey: pullsKeys.detail(owner, repo, number),
      });
      return patchPrDetail(queryClient, owner, repo, number, (pr) => ({
        ...pr,
        requested_reviewers: [
          ...pr.requested_reviewers.filter((r) => !remove.includes(r.login)),
          ...add
            .filter(
              (login) => !pr.requested_reviewers.some((r) => r.login === login),
            )
            .map((login) => ({
              login,
              avatar_url: `https://github.com/${login}.png`,
            })),
        ],
      }));
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(ctx.key, ctx.prev);
    },
    onSuccess: (updated) => {
      // Use server response to update cache
      if (updated) {
        queryClient.setQueryData(pullsKeys.detail(owner, repo, number), updated);
      }
    },
  });
}

// ─── Labels ────────────────────────────────────────────────────────────────
//
// We PUT the full name list so GitHub replaces the set in one call. The
// optimistic shape needs the full label objects (id, color, description)
// so the sidebar renders pills without a re-fetch — we look them up in
// the repo-labels cache.

export function useSetPrLabels(owner: string, repo: string, number: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ names }: { names: string[] }) => {
      const client = getGitHubClient();
      const res = await client.request(
        "PUT /repos/{owner}/{repo}/issues/{issue_number}/labels",
        { owner, repo, issue_number: number, labels: names },
      );
      // Return both the labels and parse as PR for cache update
      return { labels: res.data } as { labels: Array<{ id: number; name: string; color: string; description: string | null }> };
    },
    onMutate: async ({ names }) => {
      await queryClient.cancelQueries({
        queryKey: pullsKeys.detail(owner, repo, number),
      });
      const repoLabels =
        queryClient.getQueryData<RepoLabel[]>(repoLabelsKey(owner, repo)) ?? [];
      const byName = new Map(repoLabels.map((l) => [l.name, l]));
      return patchPrDetail(queryClient, owner, repo, number, (pr) => ({
        ...pr,
        labels: names.map((name) => {
          const found = byName.get(name);
          return found
            ? {
                id: found.id,
                name: found.name,
                color: found.color,
                description: found.description ?? null,
              }
            : pr.labels.find((l) => l.name === name) ?? {
                id: -Date.now(),
                name,
                color: "cccccc",
                description: null,
              };
        }),
      }));
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(ctx.key, ctx.prev);
    },
    onSuccess: (data, _vars, ctx) => {
      // Update PR detail with server-returned labels
      if (ctx?.prev) {
        queryClient.setQueryData<PullRequest>(ctx.key, (pr) =>
          pr ? { ...pr, labels: data.labels } : ctx.prev
        );
      }
    },
  });
}
