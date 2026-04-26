import { queryOptions, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { getGitHubClient } from "@/app/lib/github/client";
import { useAuthStore } from "@/app/stores/auth";

const RepoSchema = z.object({
  id: z.number(),
  name: z.string(),
  full_name: z.string(),
  private: z.boolean(),
  fork: z.boolean(),
  html_url: z.string(),
  description: z.string().nullable(),
  homepage: z.string().nullable(),
  language: z.string().nullable(),
  default_branch: z.string(),
  stargazers_count: z.number(),
  subscribers_count: z.number().optional(),
  watchers_count: z.number(),
  forks_count: z.number(),
  open_issues_count: z.number(),
  topics: z.array(z.string()).default([]),
  pushed_at: z.string(),
  updated_at: z.string(),
  license: z
    .object({
      key: z.string(),
      name: z.string(),
      spdx_id: z.string().nullable(),
    })
    .nullable(),
  owner: z.object({
    login: z.string(),
    avatar_url: z.string(),
    html_url: z.string(),
    type: z.enum(["User", "Organization"]),
  }),
  parent: z
    .object({
      full_name: z.string(),
      html_url: z.string(),
      owner: z.object({ login: z.string(), avatar_url: z.string() }),
    })
    .optional(),
  source: z
    .object({
      full_name: z.string(),
      html_url: z.string(),
    })
    .optional(),
});

export type Repo = z.infer<typeof RepoSchema>;

export const repoQueryOptions = (owner: string, repo: string) =>
  queryOptions({
    queryKey: ["repo", owner, repo] as const,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Repo> => {
      const client = getGitHubClient();
      const res = await client.request("GET /repos/{owner}/{repo}", { owner, repo });
      return RepoSchema.parse(res.data);
    },
  });

export function useRepo(owner: string, repo: string) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    ...repoQueryOptions(owner, repo),
    enabled: !!token && !!owner && !!repo,
  });
}
