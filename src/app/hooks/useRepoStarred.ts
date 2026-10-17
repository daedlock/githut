import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getGitHubClient } from "@/app/lib/github/client";
import { useAuthStore } from "@/app/stores/auth";

// GitHub returns 204 if the viewer has starred a repo and 404 otherwise.
// Octokit throws on non-2xx, so we catch a 404 and resolve to `false`
// rather than letting the query land in an error state.
export const repoStarredQueryOptions = (owner: string, repo: string) =>
  queryOptions({
    queryKey: ["repo-starred", owner, repo] as const,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<boolean> => {
      const client = getGitHubClient();
      try {
        await client.request("GET /user/starred/{owner}/{repo}", { owner, repo });
        return true;
      } catch (err) {
        if (err && typeof err === "object" && "status" in err && err.status === 404) {
          return false;
        }
        throw err;
      }
    },
  });

export function useRepoStarred(owner: string, repo: string) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    ...repoStarredQueryOptions(owner, repo),
    enabled: !!token && !!owner && !!repo,
  });
}

// Optimistic toggle: flip both the starred flag and the repo payload's
// stargazers_count immediately so the UI is instant. On error we restore
// from the snapshot. A single quiet invalidation re-syncs at the end.
export function useToggleStar(owner: string, repo: string) {
  const queryClient = useQueryClient();
  const starredKey = ["repo-starred", owner, repo] as const;
  const repoKey = ["repo", owner, repo] as const;

  return useMutation({
    mutationFn: async (next: boolean) => {
      const client = getGitHubClient();
      if (next) {
        await client.request("PUT /user/starred/{owner}/{repo}", { owner, repo });
      } else {
        await client.request("DELETE /user/starred/{owner}/{repo}", { owner, repo });
      }
      return next;
    },
    onMutate: async (next: boolean) => {
      await queryClient.cancelQueries({ queryKey: starredKey });
      await queryClient.cancelQueries({ queryKey: repoKey });
      const prevStarred = queryClient.getQueryData<boolean>(starredKey);
      const prevRepo = queryClient.getQueryData<{ stargazers_count: number } & object>(repoKey);
      queryClient.setQueryData<boolean>(starredKey, next);
      queryClient.setQueryData(repoKey, (old: unknown) => {
        if (!old || typeof old !== "object") return old;
        const r = old as { stargazers_count?: number };
        if (typeof r.stargazers_count !== "number") return old;
        const delta = next ? 1 : -1;
        return { ...r, stargazers_count: Math.max(0, r.stargazers_count + delta) };
      });
      return { prevStarred, prevRepo };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevStarred !== undefined) queryClient.setQueryData(starredKey, ctx.prevStarred);
      if (ctx?.prevRepo !== undefined) queryClient.setQueryData(repoKey, ctx.prevRepo);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: starredKey });
      queryClient.invalidateQueries({ queryKey: repoKey });
    },
  });
}
