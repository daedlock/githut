import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { getGitHubClient } from "@/app/lib/github/client";
import { useAuthStore } from "@/app/stores/auth";

const CommitSchema = z.object({
  sha: z.string(),
  commit: z.object({
    message: z.string(),
    author: z
      .object({
        name: z.string().nullable(),
        date: z.string().nullable(),
      })
      .nullable(),
    committer: z
      .object({
        name: z.string().nullable(),
        date: z.string().nullable(),
      })
      .nullable(),
  }),
  author: z
    .object({
      login: z.string(),
      avatar_url: z.string(),
    })
    .nullable(),
});

export type PathCommit = {
  sha: string;
  message: string;
  shortSha: string;
  authorName: string;
  date: string;
};

export function usePathCommit(owner: string, repo: string, path: string, ref?: string) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ["path-commit", owner, repo, path, ref ?? "default"],
    enabled: !!token && !!owner && !!repo,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PathCommit | null> => {
      const client = getGitHubClient();
      const res = await client.request("GET /repos/{owner}/{repo}/commits", {
        owner,
        repo,
        path: path || undefined,
        sha: ref || undefined,
        per_page: 1,
      });
      const commits = z.array(CommitSchema).parse(res.data);
      const c = commits[0];
      if (!c) return null;
      const date: string =
        c.commit.committer?.date ??
        c.commit.author?.date ??
        new Date().toISOString();
      return {
        sha: c.sha,
        shortSha: c.sha.slice(0, 7),
        message: (c.commit.message.split("\n")[0]) ?? "",
        authorName:
          (c.author?.login ??
          c.commit.author?.name ??
          c.commit.committer?.name) ??
          "unknown",
        date,
      };
    },
  });
}
