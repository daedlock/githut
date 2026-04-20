import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { getGitHubClient } from "@/app/lib/github/client";
import { useAuthStore } from "@/app/stores/auth";

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

// GitHub's file-status values from the commit details endpoint. Matches the
// FileStatus union FileDiff expects, so we pass these through directly.
const CommitFileSchema = z.object({
  sha: z.string().optional(),
  filename: z.string(),
  previous_filename: z.string().optional(),
  status: z.enum(["added", "removed", "modified", "renamed", "copied", "changed", "unchanged"]),
  additions: z.number(),
  deletions: z.number(),
  changes: z.number(),
  // `patch` is omitted for binaries and very large diffs; keep nullable so the
  // FileDiff component can surface a "binary / unavailable" state.
  patch: z.string().nullish().transform((p) => p ?? null),
  blob_url: z.string().optional(),
  raw_url: z.string().optional(),
});

const CommitDetailSchema = z.object({
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
  stats: z
    .object({
      total: z.number(),
      additions: z.number(),
      deletions: z.number(),
    })
    .optional(),
  files: z.array(CommitFileSchema).default([]),
});

export type CommitDetail = z.infer<typeof CommitDetailSchema>;
export type CommitFile = z.infer<typeof CommitFileSchema>;

export function useRepoCommit(owner: string, repo: string, ref: string | undefined) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ["repo-commit", owner, repo, ref],
    enabled: !!token && !!owner && !!repo && !!ref,
    // Commits are immutable — once fetched a SHA's detail never changes.
    // Infinite staleTime means navigating away and back never re-fetches.
    staleTime: Infinity,
    gcTime: 10 * 60_000,
    queryFn: async (): Promise<CommitDetail> => {
      const client = getGitHubClient();
      const res = await client.request("GET /repos/{owner}/{repo}/commits/{ref}", {
        owner,
        repo,
        // biome-ignore lint/style/noNonNullAssertion: enabled guard ensures this is defined
        ref: ref!,
      });
      return CommitDetailSchema.parse(res.data);
    },
  });
}
