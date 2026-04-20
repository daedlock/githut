import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { getGitHubClient } from "@/app/lib/github/client";
import { useAuthStore } from "@/app/stores/auth";

// `author` / `committer` on a commit can be null when GitHub can't map the
// git author email to a GitHub user account. The git-native author inside
// `commit.author` is always present.
const MaybeGitHubUser = z
  .object({
    login: z.string(),
    avatar_url: z.string(),
    html_url: z.string().optional(),
  })
  .nullable();

const GitAuthor = z.object({
  name: z.string(),
  email: z.string(),
  date: z.string(),
});

const CommitSummarySchema = z.object({
  sha: z.string(),
  html_url: z.string(),
  commit: z.object({
    author: GitAuthor,
    committer: GitAuthor,
    message: z.string(),
  }),
  author: MaybeGitHubUser,
  committer: MaybeGitHubUser,
  parents: z.array(z.object({ sha: z.string(), html_url: z.string() })),
});

const CommitListSchema = z.array(CommitSummarySchema);

export type CommitSummary = z.infer<typeof CommitSummarySchema>;

export function useRepoCommits(owner: string, repo: string, branch: string | undefined) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ["repo-commits", owner, repo, branch],
    enabled: !!token && !!owner && !!repo && !!branch,
    staleTime: 30_000,
    queryFn: async (): Promise<CommitSummary[]> => {
      const client = getGitHubClient();
      const res = await client.request("GET /repos/{owner}/{repo}/commits", {
        owner,
        repo,
        sha: branch,
        per_page: 100,
      });
      return CommitListSchema.parse(res.data);
    },
  });
}
