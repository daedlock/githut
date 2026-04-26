import { queryOptions, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { getGitHubClient } from "@/app/lib/github/client";
import { useAuthStore } from "@/app/stores/auth";

// GitHub returns a User-like object for "User" contributors and a leaner
// "Anonymous" record for unknown commit authors. We accept either; the
// anon path has no avatar so we only render it as a placeholder.
const ContributorSchema = z.object({
  login: z.string().optional(),
  id: z.number().optional(),
  avatar_url: z.string().optional(),
  html_url: z.string().optional(),
  type: z.string().optional(),
  contributions: z.number(),
});

export type Contributor = z.infer<typeof ContributorSchema>;

export const repoContributorsQueryOptions = (owner: string, repo: string) =>
  queryOptions({
    queryKey: ["repo-contributors", owner, repo] as const,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<Contributor[]> => {
      const client = getGitHubClient();
      const res = await client.request("GET /repos/{owner}/{repo}/contributors", {
        owner,
        repo,
        per_page: 30,
      });
      return z.array(ContributorSchema).parse(res.data);
    },
  });

export function useRepoContributors(owner: string, repo: string) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    ...repoContributorsQueryOptions(owner, repo),
    enabled: !!token && !!owner && !!repo,
  });
}
