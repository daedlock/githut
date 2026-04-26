import { queryOptions, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { getGitHubClient } from "@/app/lib/github/client";
import { useAuthStore } from "@/app/stores/auth";

const ReleaseSchema = z.object({
  id: z.number(),
  tag_name: z.string(),
  name: z.string().nullable(),
  html_url: z.string(),
  draft: z.boolean(),
  prerelease: z.boolean(),
  published_at: z.string().nullable(),
  author: z
    .object({
      login: z.string(),
      avatar_url: z.string(),
    })
    .nullable()
    .optional(),
});

export type Release = z.infer<typeof ReleaseSchema>;

export const repoReleasesQueryOptions = (owner: string, repo: string) =>
  queryOptions({
    queryKey: ["repo-releases", owner, repo] as const,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Release[]> => {
      const client = getGitHubClient();
      const res = await client.request("GET /repos/{owner}/{repo}/releases", {
        owner,
        repo,
        per_page: 10,
      });
      return z.array(ReleaseSchema).parse(res.data);
    },
  });

export function useRepoReleases(owner: string, repo: string) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    ...repoReleasesQueryOptions(owner, repo),
    enabled: !!token && !!owner && !!repo,
  });
}
