import { queryOptions, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { getGitHubClient } from "@/app/lib/github/client";
import { useAuthStore } from "@/app/stores/auth";

const LanguagesSchema = z.record(z.string(), z.number());

export type LanguageShare = {
  name: string;
  bytes: number;
  percentage: number;
};

export const repoLanguagesQueryOptions = (owner: string, repo: string) =>
  queryOptions({
    queryKey: ["repo-languages", owner, repo] as const,
    // Language composition changes slowly (only when you push a lot of code in a new
    // language). 30min avoids re-fetching on every repo-page navigation within a session.
    staleTime: 30 * 60_000,
    queryFn: async (): Promise<LanguageShare[]> => {
      const client = getGitHubClient();
      const res = await client.request("GET /repos/{owner}/{repo}/languages", { owner, repo });
      const parsed = LanguagesSchema.parse(res.data);
      const total = Object.values(parsed).reduce((sum, n) => sum + n, 0);
      if (total === 0) return [];
      return Object.entries(parsed)
        .map(([name, bytes]) => ({ name, bytes, percentage: (bytes / total) * 100 }))
        .sort((a, b) => b.bytes - a.bytes);
    },
  });

export function useRepoLanguages(owner: string, repo: string) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    ...repoLanguagesQueryOptions(owner, repo),
    enabled: !!token && !!owner && !!repo,
  });
}
