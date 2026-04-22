import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { getGitHubClient } from "@/app/lib/github/client";
import { useAuthStore } from "@/app/stores/auth";

export type MentionUser = {
  kind: "@";
  id: string;
  login: string;
  avatar: string;
};

export type MentionIssue = {
  kind: "#";
  id: string;
  number: number;
  title: string;
  state: "open" | "closed";
  isPR: boolean;
};

export type MentionItem = MentionUser | MentionIssue;

// ── GraphQL queries ──────────────────────────────────────────────────────────

const USERS_QUERY = /* GraphQL */ `
  query MentionableUsers($owner: String!, $repo: String!, $q: String!) {
    repository(owner: $owner, name: $repo) {
      mentionableUsers(first: 7, query: $q) {
        nodes { login avatarUrl }
      }
    }
  }
`;

const ISSUES_QUERY = /* GraphQL */ `
  query SearchIssues($q: String!) {
    search(query: $q, type: ISSUE, first: 7) {
      nodes {
        __typename
        ... on Issue { number title state }
        ... on PullRequest { number title state }
      }
    }
  }
`;

// ── Response validation ──────────────────────────────────────────────────────

const UsersResponseSchema = z.object({
  repository: z
    .object({
      mentionableUsers: z.object({
        nodes: z.array(z.object({ login: z.string(), avatarUrl: z.string() })),
      }),
    })
    .nullable(),
});

const IssuesResponseSchema = z.object({
  search: z.object({
    nodes: z.array(
      z.object({
        __typename: z.enum(["Issue", "PullRequest"]),
        number: z.number(),
        title: z.string(),
        state: z.string(),
      }),
    ),
  }),
});

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useMentionSearch(
  owner: string,
  repo: string,
  type: "@" | "#" | null,
  query: string,
) {
  const token = useAuthStore((s) => s.token);

  return useQuery({
    queryKey: ["mention-search", owner, repo, type, query],
    enabled: !!token && !!owner && !!repo && !!type,
    staleTime: 30_000,
    // Keep the previous list visible while a new query is in flight —
    // avoids the dropdown going blank between keystrokes.
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<MentionItem[]> => {
      const client = getGitHubClient();

      if (type === "@") {
        let res: unknown;
        res = await client.graphql<unknown>(USERS_QUERY, {
          owner,
          repo,
          q: query,
        });
        const parsed = UsersResponseSchema.parse(res);
        const nodes = parsed.repository?.mentionableUsers.nodes ?? [];
        return nodes.map(
          (n): MentionUser => ({
            kind: "@",
            id: n.login,
            login: n.login,
            avatar: n.avatarUrl,
          }),
        );
      }

      // Strictly repo-scoped — never falls through to GitHub-wide search.
      const q = query.trim()
        ? `repo:${owner}/${repo} ${query.trim()}`
        : `repo:${owner}/${repo}`;
      const res = await client.graphql<unknown>(ISSUES_QUERY, { q });
      const parsed = IssuesResponseSchema.parse(res);

      return parsed.search.nodes.map(
        (n): MentionIssue => ({
          kind: "#",
          id: `${n.__typename}-${n.number}`,
          number: n.number,
          title: n.title,
          state: n.state.toLowerCase() === "closed" ? "closed" : "open",
          isPR: n.__typename === "PullRequest",
        }),
      );
    },
  });
}
