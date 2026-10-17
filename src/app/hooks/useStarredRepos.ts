import { queryOptions, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { getGitHubClient } from "@/app/lib/github/client";
import { useAuthStore } from "@/app/stores/auth";

const StarredReposSchema = z.array(
  z.object({ id: z.number(), full_name: z.string(), name: z.string() }),
);
export type StarredRepo = z.infer<typeof StarredReposSchema>[number];

export const starredReposQueryOptions = () =>
  queryOptions({
    queryKey: ["starred-repos"] as const,
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }): Promise<StarredRepo[]> => {
      const client = getGitHubClient();
      const repos: StarredRepo[] = [];
      for (let page = 1; ; page++) {
        const response = await client.request("GET /user/starred", {
          per_page: 100,
          page,
          sort: "created",
          direction: "desc",
          request: { signal },
        });
        repos.push(...StarredReposSchema.parse(response.data));
        if (!response.headers.link?.includes('rel="next"')) break;
      }
      return repos;
    },
  });

export function useStarredRepos() {
  const token = useAuthStore((state) => state.token);
  return useQuery({ ...starredReposQueryOptions(), enabled: !!token });
}
