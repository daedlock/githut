import { queryOptions, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import type { PathCommit } from "@/app/hooks/usePathCommit";
import { getGitHubClient } from "@/app/lib/github/client";
import { useAuthStore } from "@/app/stores/auth";

const Commit = z.object({
  oid: z.string(),
  message: z.string(),
  committedDate: z.string(),
  author: z
    .object({ name: z.string().nullable(), user: z.object({ login: z.string() }).nullable() })
    .nullable(),
});
const Response = z.object({
  repository: z
    .object({
      head: z
        .object({
          target: z.record(z.string(), z.object({ nodes: z.array(Commit) })).nullable(),
        })
        .nullable(),
    })
    .nullable(),
});

/** One history alias per path, bounded to 50 aliases per request. */
export const directoryCommitsQueryOptions = (
  owner: string,
  repo: string,
  paths: string[],
  ref?: string,
) => {
  const sorted = [...new Set(paths)].sort();
  return queryOptions({
    queryKey: ["directory-commits", owner, repo, ref ?? "default", sorted] as const,
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }): Promise<Record<string, PathCommit | null>> => {
      const result: Record<string, PathCommit | null> = Object.create(null);
      const client = getGitHubClient();
      for (let offset = 0; offset < sorted.length; offset += 50) {
        signal.throwIfAborted();
        const batch = sorted.slice(offset, offset + 50);
        const histories = batch
          .map(
            (_, i) =>
              `p${i}: history(first: 1, path: $p${i}) { nodes { oid message committedDate author { name user { login } } } }`,
          )
          .join("\n");
        const variables = batch.map((_, i) => `$p${i}: String!`).join(", ");
        // Peel annotated tags too: their GitObject is a Tag, not a Commit.
        const query = ref
          ? `query($owner: String!, $repo: String!, $ref: String!, ${variables}) { repository(owner: $owner, name: $repo) { head: object(expression: $ref) { ... on Commit { ${histories} } } } }`
          : `query($owner: String!, $repo: String!, ${variables}) { repository(owner: $owner, name: $repo) { head: defaultBranchRef { target { ... on Commit { ${histories} } } } } }`;
        const raw = await client.graphql(query, {
          owner,
          repo,
          ...(ref ? { ref: `${ref}^{commit}` } : {}),
          ...Object.fromEntries(batch.map((path, i) => [`p${i}`, path])),
          request: { signal },
        });
        // Normalize the two GitHub root shapes before validating the response.
        const envelope = z
          .object({ repository: z.object({ head: z.unknown() }).nullable() })
          .parse(raw);
        const data = Response.parse(
          ref && envelope.repository
            ? {
                repository: {
                  head:
                    envelope.repository.head == null ? null : { target: envelope.repository.head },
                },
              }
            : raw,
        );
        batch.forEach((path, i) => {
          const commit = data.repository?.head?.target?.[`p${i}`]?.nodes[0];
          result[path] = commit
            ? {
                sha: commit.oid,
                shortSha: commit.oid.slice(0, 7),
                message: commit.message.split("\n")[0] ?? "",
                authorName: commit.author?.user?.login ?? commit.author?.name ?? "unknown",
                date: commit.committedDate,
              }
            : null;
        });
      }
      return result;
    },
  });
};

export function useDirectoryCommits(owner: string, repo: string, paths: string[], ref?: string) {
  const token = useAuthStore((state) => state.token);
  return useQuery({
    ...directoryCommitsQueryOptions(owner, repo, paths, ref),
    enabled: !!token && !!owner && !!repo && paths.length > 0,
  });
}
