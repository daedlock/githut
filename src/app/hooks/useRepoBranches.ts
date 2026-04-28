import { queryOptions, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { getGitHubClient } from "@/app/lib/github/client";
import { useAuthStore } from "@/app/stores/auth";

const BranchSchema = z.object({
  name: z.string(),
  commit: z.object({
    sha: z.string(),
    url: z.string(),
  }),
  protected: z.boolean(),
});

const BranchListSchema = z.array(BranchSchema);

export type RepoBranch = z.infer<typeof BranchSchema>;

export const repoBranchesQueryOptions = (owner: string, repo: string) =>
  queryOptions({
    queryKey: ["repo-branches", owner, repo] as const,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<RepoBranch[]> => {
      const client = getGitHubClient();
      const res = await client.request("GET /repos/{owner}/{repo}/branches", {
        owner,
        repo,
        per_page: 100,
      });
      return BranchListSchema.parse(res.data);
    },
  });

export function useRepoBranches(owner: string, repo: string) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    ...repoBranchesQueryOptions(owner, repo),
    enabled: !!token && !!owner && !!repo,
  });
}
