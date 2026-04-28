import { infiniteQueryOptions, useInfiniteQuery } from "@tanstack/react-query";
import { CommitListSchema, type CommitSummary } from "@/app/hooks/useRepoCommits";
import { getGitHubClient } from "@/app/lib/github/client";
import { useAuthStore } from "@/app/stores/auth";

const FILE_HISTORY_PER_PAGE = 50;

export const repoFileHistoryQueryOptions = (
  owner: string,
  repo: string,
  path: string,
  branch: string,
) =>
  infiniteQueryOptions({
    queryKey: ["repo-file-history", owner, repo, path, branch] as const,
    staleTime: 2 * 60_000,
    initialPageParam: 1,
    getNextPageParam: (lastPage: CommitSummary[], _allPages, lastPageParam) =>
      lastPage.length < FILE_HISTORY_PER_PAGE ? undefined : (lastPageParam as number) + 1,
    queryFn: async ({ pageParam }): Promise<CommitSummary[]> => {
      const client = getGitHubClient();
      const res = await client.request("GET /repos/{owner}/{repo}/commits", {
        owner,
        repo,
        sha: branch,
        path,
        per_page: FILE_HISTORY_PER_PAGE,
        page: pageParam as number,
      });
      return CommitListSchema.parse(res.data);
    },
  });

export function useRepoFileHistory(
  owner: string,
  repo: string,
  path: string,
  branch: string | undefined,
) {
  const token = useAuthStore((s) => s.token);
  return useInfiniteQuery({
    ...repoFileHistoryQueryOptions(owner, repo, path, branch ?? ""),
    enabled: !!token && !!owner && !!repo && !!path && !!branch,
  });
}
