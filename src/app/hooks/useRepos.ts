import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { getGitHubClient } from "@/app/lib/github/client";
import { useAuthStore } from "@/app/stores/auth";
import type { RepoSummary } from "@/shared/types";

const GhRepoSchema = z.object({
  id: z.number(),
  name: z.string(),
  full_name: z.string(),
  private: z.boolean(),
  description: z.string().nullable(),
  language: z.string().nullable(),
  stargazers_count: z.number(),
  pushed_at: z.string(),
  owner: z.object({
    login: z.string(),
    avatar_url: z.string(),
    type: z.enum(["User", "Organization"]),
  }),
});
const GhReposSchema = z.array(GhRepoSchema);

function toSummary(r: z.infer<typeof GhRepoSchema>): RepoSummary {
  return {
    id: r.id,
    name: r.name,
    fullName: r.full_name,
    owner: { login: r.owner.login, avatarUrl: r.owner.avatar_url, type: r.owner.type },
    description: r.description,
    language: r.language,
    stars: r.stargazers_count,
    pushedAt: r.pushed_at,
    visibility: r.private ? "private" : "public",
  };
}

export function useRepos() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ["repos", "me"],
    enabled: !!token,
    staleTime: 60_000,
    queryFn: async (): Promise<RepoSummary[]> => {
      const client = getGitHubClient();
      const res = await client.request("GET /user/repos", {
        visibility: "all",
        affiliation: "owner,collaborator,organization_member",
        sort: "pushed",
        direction: "desc",
        per_page: 100,
      });
      const parsed = GhReposSchema.parse(res.data);
      return parsed.map(toSummary);
    },
  });
}
