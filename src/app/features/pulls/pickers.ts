import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { pullsKeys } from "@/app/features/pulls/hooks";
import { type PullRequest, PullRequestSchema } from "@/app/features/pulls/schemas";
import {
  githubAvatarUrl,
  isLikelyGitHubLogin,
  knownGitHubAppActorForInput,
  knownGitHubAppActorsForQuery,
} from "@/app/lib/github/appActors";
import { getGitHubClient } from "@/app/lib/github/client";
import { useAuthStore } from "@/app/stores/auth";

const RepoLabelSchema = z.object({
  id: z.number(),
  name: z.string(),
  color: z.string(),
  description: z.string().nullable().optional(),
});
export type RepoLabel = z.infer<typeof RepoLabelSchema>;

const RepoLabelsResponseSchema = z.array(RepoLabelSchema);

const CollaboratorSchema = z.object({
  id: z.number(),
  login: z.string(),
  avatar_url: z.string(),
  type: z.string().optional(),
});
export type Collaborator = z.infer<typeof CollaboratorSchema>;

const CollaboratorsResponseSchema = z.array(CollaboratorSchema);

const GitHubUserSearchResultSchema = z.object({
  login: z.string(),
  avatar_url: z.string(),
  type: z.string().optional(),
});
export type GitHubUserSearchResult = z.infer<typeof GitHubUserSearchResultSchema>;

const GitHubUserSearchResponseSchema = z.object({
  items: z.array(GitHubUserSearchResultSchema),
});

const REQUEST_REVIEWS_BY_LOGIN_MUTATION = /* GraphQL */ `
  mutation RequestReviewsByLogin(
    $pullRequestId: ID!
    $userLogins: [String!]
    $botLogins: [String!]
  ) {
    requestReviewsByLogin(
      input: {
        pullRequestId: $pullRequestId
        userLogins: $userLogins
        botLogins: $botLogins
        union: true
      }
    ) {
      pullRequest { id }
    }
  }
`;

export const repoLabelsKey = (owner: string, repo: string) => ["repo-labels", owner, repo] as const;

export const repoCollaboratorsKey = (owner: string, repo: string) =>
  ["repo-collaborators", owner, repo] as const;

export const githubUserSearchKey = (query: string) =>
  ["github-user-search", query.trim().toLowerCase()] as const;

export const repoLabelsQueryOptions = (owner: string, repo: string) =>
  queryOptions({
    queryKey: repoLabelsKey(owner, repo),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<RepoLabel[]> => {
      const client = getGitHubClient();
      const res = await client.request("GET /repos/{owner}/{repo}/labels", {
        owner,
        repo,
        per_page: 100,
      });
      return RepoLabelsResponseSchema.parse(res.data);
    },
  });

export function useRepoLabels(owner: string, repo: string) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    ...repoLabelsQueryOptions(owner, repo),
    enabled: !!token && !!owner && !!repo,
  });
}

export const repoCollaboratorsQueryOptions = (owner: string, repo: string) =>
  queryOptions({
    queryKey: repoCollaboratorsKey(owner, repo),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Collaborator[]> => {
      const client = getGitHubClient();
      const res = await client.request("GET /repos/{owner}/{repo}/collaborators", {
        owner,
        repo,
        per_page: 100,
        affiliation: "all",
      });
      return CollaboratorsResponseSchema.parse(res.data);
    },
  });

export function useRepoCollaborators(owner: string, repo: string) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    ...repoCollaboratorsQueryOptions(owner, repo),
    enabled: !!token && !!owner && !!repo,
  });
}

export function useGitHubUserSearch(query: string) {
  const token = useAuthStore((s) => s.token);
  const q = query.trim();

  return useQuery({
    queryKey: githubUserSearchKey(q),
    enabled: !!token && q.length >= 2,
    staleTime: 60_000,
    queryFn: async (): Promise<GitHubUserSearchResult[]> => {
      const client = getGitHubClient();
      const res = await client.request("GET /search/users", {
        q: `${q} in:login`,
        per_page: 10,
      });
      return GitHubUserSearchResponseSchema.parse(res.data).items;
    },
  });
}

export function reviewerLoginForInput(input: string) {
  const q = input.trim();
  return knownGitHubAppActorForInput(q)?.reviewerLogin ?? (isLikelyGitHubLogin(q) ? q : null);
}

export function reviewerAvatarForLogin(login: string) {
  const known = knownGitHubAppActorForInput(login);
  return known?.avatarUrl ?? githubAvatarUrl(login);
}

export function reviewerDisplayLogin(login: string) {
  return knownGitHubAppActorForInput(login)?.reviewerLogin ?? login;
}

function reviewerAliases(login: string) {
  const known = knownGitHubAppActorForInput(login);
  return [login, known?.reviewerLogin, known?.botLogin, known?.mentionLogin].filter(
    (value) => !!value,
  );
}

function splitReviewRequestLogins(logins: string[]) {
  const userLogins: string[] = [];
  const botLogins: string[] = [];

  for (const login of logins) {
    const known = knownGitHubAppActorForInput(login);
    const botLogin = known?.botLogin ?? (login.endsWith("[bot]") ? login : null);
    if (botLogin) botLogins.push(botLogin);
    else userLogins.push(login);
  }

  return { userLogins, botLogins };
}

export function knownReviewerItemsForQuery(query: string) {
  return knownGitHubAppActorsForQuery(query).map((actor) => ({
    id: actor.reviewerLogin,
    label: actor.displayLogin,
    description: actor.description,
    avatarUrl: actor.avatarUrl,
  }));
}

// ─── Mutations ─────────────────────────────────────────────────────────────

function patchPrDetail(
  queryClient: ReturnType<typeof useQueryClient>,
  owner: string,
  repo: string,
  number: number,
  mutator: (pr: PullRequest) => PullRequest,
) {
  const key = pullsKeys.detail(owner, repo, number);
  const prev = queryClient.getQueryData<PullRequest>(key);
  if (prev) queryClient.setQueryData<PullRequest>(key, mutator(prev));
  return { key, prev };
}

// ─── Assignees ─────────────────────────────────────────────────────────────
// POST returns updated issue/PR
// DELETE returns 200 with NO body (just removes)

export function useSetPrAssignees(owner: string, repo: string, number: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ add, remove }: { add: string[]; remove: string[] }) => {
      const client = getGitHubClient();
      let result: PullRequest | null = null;

      if (add.length > 0) {
        // POST returns the updated issue/PR
        const res = await client.request(
          "POST /repos/{owner}/{repo}/issues/{issue_number}/assignees",
          { owner, repo, issue_number: number, assignees: add },
        );
        result = PullRequestSchema.parse(res.data);
      }

      if (remove.length > 0) {
        // DELETE returns 200 but NO body - must refetch
        await client.request("DELETE /repos/{owner}/{repo}/issues/{issue_number}/assignees", {
          owner,
          repo,
          issue_number: number,
          assignees: remove,
        });
        // If we also added, the result is stale now, need to refetch
        result = null;
      }

      return result;
    },
    onMutate: async ({ add, remove }) => {
      await queryClient.cancelQueries({
        queryKey: pullsKeys.detail(owner, repo, number),
      });
      return patchPrDetail(queryClient, owner, repo, number, (pr) => ({
        ...pr,
        assignees: [
          ...pr.assignees.filter((a) => !remove.includes(a.login)),
          ...add
            .filter((login) => !pr.assignees.some((a) => a.login === login))
            .map((login) => ({ login, avatar_url: `https://github.com/${login}.png` })),
        ],
      }));
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(ctx.key, ctx.prev);
    },
    onSuccess: async (updated) => {
      if (updated) {
        queryClient.setQueryData(pullsKeys.detail(owner, repo, number), updated);
        await queryClient.invalidateQueries({ queryKey: pullsKeys.lists(owner, repo) });
      } else {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: pullsKeys.detail(owner, repo, number) }),
          queryClient.invalidateQueries({ queryKey: pullsKeys.lists(owner, repo) }),
        ]);
      }
    },
  });
}

// ─── Requested reviewers ───────────────────────────────────────────────────
// POST returns updated PR
// DELETE returns 200 with NO body

export function useSetPrReviewers(
  owner: string,
  repo: string,
  number: number,
  pullRequestId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ add, remove }: { add: string[]; remove: string[] }) => {
      const client = getGitHubClient();
      let result: PullRequest | null = null;

      if (add.length > 0) {
        const { userLogins, botLogins } = splitReviewRequestLogins(add);
        await client.graphql(REQUEST_REVIEWS_BY_LOGIN_MUTATION, {
          pullRequestId,
          userLogins,
          botLogins,
        });
      }

      if (remove.length > 0) {
        await client.request(
          "DELETE /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers",
          { owner, repo, pull_number: number, reviewers: remove },
        );
        result = null; // Must refetch
      }

      return result;
    },
    onMutate: async ({ add, remove }) => {
      await queryClient.cancelQueries({
        queryKey: pullsKeys.detail(owner, repo, number),
      });
      return patchPrDetail(queryClient, owner, repo, number, (pr) => ({
        ...pr,
        requested_reviewers: [
          ...pr.requested_reviewers.filter(
            (r) => !reviewerAliases(r.login).some((alias) => remove.includes(alias)),
          ),
          ...add
            .filter(
              (login) =>
                !pr.requested_reviewers.some((r) => reviewerAliases(r.login).includes(login)),
            )
            .map((login) => ({
              login: reviewerDisplayLogin(login),
              avatar_url: reviewerAvatarForLogin(login),
            })),
        ],
      }));
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(ctx.key, ctx.prev);
    },
    onSuccess: async (updated) => {
      if (updated) {
        queryClient.setQueryData(pullsKeys.detail(owner, repo, number), updated);
        await queryClient.invalidateQueries({ queryKey: pullsKeys.lists(owner, repo) });
      } else {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: pullsKeys.detail(owner, repo, number) }),
          queryClient.invalidateQueries({ queryKey: pullsKeys.lists(owner, repo) }),
        ]);
      }
    },
  });
}

// ─── Labels ────────────────────────────────────────────────────────────────
// PUT returns array of labels (not full PR)

export function useSetPrLabels(owner: string, repo: string, number: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ names }: { names: string[] }) => {
      const client = getGitHubClient();
      const res = await client.request("PUT /repos/{owner}/{repo}/issues/{issue_number}/labels", {
        owner,
        repo,
        issue_number: number,
        labels: names,
      });
      // Returns array of label objects
      return res.data as Array<{
        id: number;
        name: string;
        color: string;
        description: string | null;
      }>;
    },
    onMutate: async ({ names }) => {
      await queryClient.cancelQueries({
        queryKey: pullsKeys.detail(owner, repo, number),
      });
      const repoLabels = queryClient.getQueryData<RepoLabel[]>(repoLabelsKey(owner, repo)) ?? [];
      const byName = new Map(repoLabels.map((l) => [l.name, l]));
      return patchPrDetail(queryClient, owner, repo, number, (pr) => ({
        ...pr,
        labels: names.map((name) => {
          const found = byName.get(name);
          return found
            ? {
                id: found.id,
                name: found.name,
                color: found.color,
                description: found.description ?? null,
              }
            : (pr.labels.find((l) => l.name === name) ?? {
                id: -Date.now(),
                name,
                color: "cccccc",
                description: null,
              });
        }),
      }));
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(ctx.key, ctx.prev);
    },
    onSuccess: async (labels, _vars, ctx) => {
      if (ctx?.key) {
        queryClient.setQueryData<PullRequest>(ctx.key, (pr) =>
          pr ? { ...pr, labels } : undefined,
        );
      }
      await queryClient.invalidateQueries({ queryKey: pullsKeys.lists(owner, repo) });
    },
  });
}
