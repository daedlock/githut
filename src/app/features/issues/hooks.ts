import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  IssueCommentSchema,
  IssueCommentsSchema,
  IssueDetailSchema,
  IssueListSchema,
  type ReactionContent,
  type ReactionsMap,
  type RepoIssue,
  type RepoIssueComment,
} from "@/app/features/issues/schemas";
import {
  type ReactionToggleVars,
  useViewerReactionToggle,
  viewerReactionKeys,
} from "@/app/features/issues/viewerReactions";
import { type RepoLabel, repoLabelsKey } from "@/app/features/pulls/pickers";
import { useLiveInterval } from "@/app/lib/freshness";
import { getGitHubClient } from "@/app/lib/github/client";
import { useAuthStore } from "@/app/stores/auth";
import { clearSentDraft, type SentDraft } from "@/app/stores/drafts";

// ─── Query keys ─────────────────────────────────────────────────────────────
//
// Keep all issue-related cache keys in one place so mutation invalidators
// can't drift from query constructors.

export const issueKeys = {
  all: (owner: string, repo: string) => ["repo-issues", owner, repo] as const,
  detail: (owner: string, repo: string, issueNumber: number | undefined) =>
    ["repo-issue", owner, repo, issueNumber] as const,
  comments: (owner: string, repo: string, issueNumber: number | undefined) =>
    ["repo-issue-comments", owner, repo, issueNumber] as const,
};

// ─── Queries ────────────────────────────────────────────────────────────────

export const repoIssuesQueryOptions = (owner: string, repo: string) =>
  queryOptions({
    queryKey: issueKeys.all(owner, repo),
    staleTime: 30_000,
    queryFn: async (): Promise<RepoIssue[]> => {
      const client = getGitHubClient();
      const res = await client.request("GET /repos/{owner}/{repo}/issues", {
        owner,
        repo,
        state: "all",
        per_page: 100,
        sort: "updated",
        direction: "desc",
      });
      return IssueListSchema.parse(res.data).filter((i) => !i.pull_request);
    },
  });

export function useRepoIssues(owner: string, repo: string) {
  const token = useAuthStore((s) => s.token);
  const live = useLiveInterval();
  return useQuery({
    ...repoIssuesQueryOptions(owner, repo),
    enabled: !!token && !!owner && !!repo,
    refetchInterval: () => live("changing"),
  });
}

export const issueDetailQueryOptions = (owner: string, repo: string, issueNumber: number) =>
  queryOptions({
    queryKey: issueKeys.detail(owner, repo, issueNumber),
    queryFn: async (): Promise<RepoIssue> => {
      const client = getGitHubClient();
      const res = await client.request("GET /repos/{owner}/{repo}/issues/{issue_number}", {
        owner,
        repo,
        issue_number: issueNumber,
      });
      return IssueDetailSchema.parse(res.data);
    },
  });

export function useRepoIssue(owner: string, repo: string, issueNumber: number | undefined) {
  const token = useAuthStore((s) => s.token);
  const live = useLiveInterval();
  return useQuery({
    // enabled guard ensures issueNumber is defined before the query runs
    ...issueDetailQueryOptions(owner, repo, issueNumber ?? 0),
    queryKey: issueKeys.detail(owner, repo, issueNumber),
    enabled: !!token && !!owner && !!repo && !!issueNumber,
    refetchInterval: () => live("changing"),
  });
}

export function useRepoIssueComments(owner: string, repo: string, issueNumber: number | undefined) {
  const token = useAuthStore((s) => s.token);
  const live = useLiveInterval();
  return useQuery({
    queryKey: issueKeys.comments(owner, repo, issueNumber),
    enabled: !!token && !!owner && !!repo && !!issueNumber,
    refetchInterval: () => live("changing"),
    queryFn: async (): Promise<RepoIssueComment[]> => {
      const client = getGitHubClient();
      const res = await client.request("GET /repos/{owner}/{repo}/issues/{issue_number}/comments", {
        owner,
        repo,
        // enabled guard ensures issueNumber is defined
        issue_number: issueNumber!,
        per_page: 100,
      });
      return IssueCommentsSchema.parse(res.data);
    },
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────
//
// Every write is optimistic:
//   onMutate    — cancel in-flight, snapshot cache, write the optimistic value
//   onError     — restore from snapshot
//   onSettled   — single quiet invalidation to resync with the server
// This is why the UI feels "instant" — we never block on the network round-trip.

export function useCreateIssue(owner: string, repo: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ title, body }: { title: string; body: string }) => {
      const client = getGitHubClient();
      const res = await client.request("POST /repos/{owner}/{repo}/issues", {
        owner,
        repo,
        title,
        body,
      });
      return IssueDetailSchema.parse(res.data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: issueKeys.all(owner, repo) });
      await queryClient.invalidateQueries({ queryKey: ["repo-issue", owner, repo] });
    },
  });
}

export function useCreateIssueComment(
  owner: string,
  repo: string,
  me: { id: number; login: string; avatar_url: string } | undefined,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      issueNumber: n,
      body,
    }: {
      issueNumber: number;
      body: string;
      draft?: SentDraft;
    }) => {
      const client = getGitHubClient();
      const res = await client.request(
        "POST /repos/{owner}/{repo}/issues/{issue_number}/comments",
        { owner, repo, issue_number: n, body },
      );
      return IssueCommentSchema.parse(res.data);
    },
    onMutate: async ({ issueNumber: n, body }) => {
      const key = issueKeys.comments(owner, repo, n);
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<RepoIssueComment[]>(key);
      const tempId = -Date.now();
      const nowIso = new Date().toISOString();
      const optimistic: RepoIssueComment = {
        id: tempId,
        body,
        created_at: nowIso,
        updated_at: nowIso,
        user: {
          login: me?.login ?? "you",
          avatar_url: me?.avatar_url ?? "",
          html_url: undefined,
        },
        reactions: {
          "+1": 0,
          "-1": 0,
          laugh: 0,
          hooray: 0,
          confused: 0,
          heart: 0,
          rocket: 0,
          eyes: 0,
        },
      };
      queryClient.setQueryData<RepoIssueComment[]>(key, (old) => [...(old ?? []), optimistic]);
      return { prev, tempId, key };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(ctx.key, ctx.prev);
    },
    onSuccess: (created, vars, ctx) => {
      clearSentDraft(vars.draft);
      // Swap temp → real in place
      if (ctx) {
        queryClient.setQueryData<RepoIssueComment[]>(ctx.key, (old) =>
          (old ?? []).map((c) => (c.id === ctx.tempId ? created : c)),
        );
      }
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: issueKeys.detail(owner, repo, vars.issueNumber) });
      queryClient.invalidateQueries({ queryKey: issueKeys.all(owner, repo) });
    },
  });
}

export function useUpdateIssueState(owner: string, repo: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      issueNumber: n,
      nextState,
    }: {
      issueNumber: number;
      nextState: "open" | "closed";
    }) => {
      const client = getGitHubClient();
      const res = await client.request("PATCH /repos/{owner}/{repo}/issues/{issue_number}", {
        owner,
        repo,
        issue_number: n,
        state: nextState,
      });
      return IssueDetailSchema.parse(res.data);
    },
    onMutate: async ({ issueNumber: n, nextState }) => {
      const iKey = issueKeys.detail(owner, repo, n);
      const listKey = issueKeys.all(owner, repo);

      // Snapshot + optimistic write FIRST, synchronously. Do this before the
      // `await cancelQueries` calls so React sees the new state in the same
      // tick as the click — otherwise the awaits postpone the setQueryData
      // to a microtask and the UI feels laggy.
      const prevIssue = queryClient.getQueryData<RepoIssue>(iKey);
      const prevList = queryClient.getQueryData<RepoIssue[]>(listKey);
      const nowIso = new Date().toISOString();
      if (prevIssue) {
        queryClient.setQueryData<RepoIssue>(iKey, {
          ...prevIssue,
          state: nextState,
          closed_at: nextState === "closed" ? nowIso : null,
          updated_at: nowIso,
        });
      }
      if (prevList) {
        queryClient.setQueryData<RepoIssue[]>(
          listKey,
          prevList.map((i) =>
            i.number === n
              ? {
                  ...i,
                  state: nextState,
                  closed_at: nextState === "closed" ? nowIso : null,
                  updated_at: nowIso,
                }
              : i,
          ),
        );
      }

      // Now cancel in-flight refetches so they can't clobber the optimistic write.
      await queryClient.cancelQueries({ queryKey: iKey });
      await queryClient.cancelQueries({ queryKey: listKey });

      return { prevIssue, prevList, iKey, listKey };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevIssue) queryClient.setQueryData(ctx.iKey, ctx.prevIssue);
      if (ctx?.prevList) queryClient.setQueryData(ctx.listKey, ctx.prevList);
    },
    // Use the PATCH *response* to finalize the cache. We deliberately DO NOT
    // run invalidateQueries for the detail key — GitHub's GET endpoint has brief
    // read-after-write inconsistency after a state change, and a refetch can
    // transiently return the old state, clobbering our optimistic flip. The
    // PATCH response is always authoritative, so we write it directly.
    onSuccess: (updated, vars) => {
      queryClient.setQueryData(issueKeys.detail(owner, repo, vars.issueNumber), updated);
      queryClient.setQueryData<RepoIssue[]>(issueKeys.all(owner, repo), (old) =>
        old?.map((i) => (i.number === vars.issueNumber ? updated : i)),
      );
    },
  });
}

/**
 * Toggle a reaction on the issue body. The viewer's reaction state lives in
 * the issue's viewer-reactions entry (one GraphQL request per issue, #61).
 */
export function useToggleIssueReaction(
  owner: string,
  repo: string,
  issueNumber: number | undefined,
  meId: number | undefined,
) {
  return useViewerReactionToggle({
    owner,
    repo,
    meId,
    reactionsKey: viewerReactionKeys.issue(owner, repo, issueNumber),
    countsKey: issueKeys.detail(owner, repo, issueNumber),
    targetOf: (vars: ReactionToggleVars & { issueNumber: number }) => ({
      kind: "subject",
      number: vars.issueNumber,
    }),
    patchCounts: (issue: RepoIssue, vars, delta) => bumpReaction(issue, vars.content, delta),
  });
}

export function useToggleCommentReaction(
  owner: string,
  repo: string,
  issueNumber: number | undefined,
  meId: number | undefined,
) {
  return useViewerReactionToggle({
    owner,
    repo,
    meId,
    reactionsKey: viewerReactionKeys.issue(owner, repo, issueNumber),
    countsKey: issueKeys.comments(owner, repo, issueNumber),
    targetOf: (vars: ReactionToggleVars & { commentId: number }) => ({
      kind: "comment",
      id: vars.commentId,
    }),
    patchCounts: (list: RepoIssueComment[], vars, delta) =>
      list.map((c) => (c.id === vars.commentId ? bumpReaction(c, vars.content, delta) : c)),
  });
}

function bumpReaction<T extends { reactions: ReactionsMap }>(
  item: T,
  content: ReactionContent,
  delta: number,
): T {
  return {
    ...item,
    reactions: {
      ...item.reactions,
      [content]: Math.max(0, (item.reactions[content] ?? 0) + delta),
    },
  };
}

// ─── Issue assignees ──────────────────────────────────────────────────────

function patchIssueDetail(
  queryClient: ReturnType<typeof useQueryClient>,
  owner: string,
  repo: string,
  number: number,
  mutator: (issue: RepoIssue) => RepoIssue,
) {
  const key = issueKeys.detail(owner, repo, number);
  const prev = queryClient.getQueryData<RepoIssue>(key);
  if (prev) queryClient.setQueryData<RepoIssue>(key, mutator(prev));
  return { key, prev };
}

export function useSetIssueAssignees(owner: string, repo: string, number: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ add, remove }: { add: string[]; remove: string[] }) => {
      const client = getGitHubClient();
      if (add.length > 0) {
        await client.request("POST /repos/{owner}/{repo}/issues/{issue_number}/assignees", {
          owner,
          repo,
          issue_number: number,
          assignees: add,
        });
      }
      if (remove.length > 0) {
        await client.request("DELETE /repos/{owner}/{repo}/issues/{issue_number}/assignees", {
          owner,
          repo,
          issue_number: number,
          assignees: remove,
        });
      }
    },
    onMutate: async ({ add, remove }) => {
      await queryClient.cancelQueries({ queryKey: issueKeys.detail(owner, repo, number) });
      return patchIssueDetail(queryClient, owner, repo, number, (issue) => ({
        ...issue,
        assignees: [
          ...issue.assignees.filter((a) => !remove.includes(a.login)),
          ...add
            .filter((login) => !issue.assignees.some((a) => a.login === login))
            .map((login) => ({
              login,
              avatar_url: `https://github.com/${login}.png`,
              html_url: `https://github.com/${login}`,
            })),
        ],
      }));
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: issueKeys.detail(owner, repo, number) });
      queryClient.invalidateQueries({ queryKey: issueKeys.all(owner, repo) });
    },
  });
}

// ─── Issue labels ─────────────────────────────────────────────────────────

export function useSetIssueLabels(owner: string, repo: string, number: number) {
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
      return res.data as Array<{
        id: number;
        name: string;
        color: string;
        description: string | null;
      }>;
    },
    onMutate: async ({ names }) => {
      await queryClient.cancelQueries({ queryKey: issueKeys.detail(owner, repo, number) });
      const repoLabels = queryClient.getQueryData<RepoLabel[]>(repoLabelsKey(owner, repo)) ?? [];
      const byName = new Map(repoLabels.map((l) => [l.name, l]));
      return patchIssueDetail(queryClient, owner, repo, number, (issue) => ({
        ...issue,
        labels: names.map((name) => {
          const found = byName.get(name);
          return found
            ? {
                id: found.id,
                name: found.name,
                color: found.color,
                description: found.description ?? null,
              }
            : (issue.labels.find((l) => l.name === name) ?? {
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
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: issueKeys.detail(owner, repo, number) });
      queryClient.invalidateQueries({ queryKey: issueKeys.all(owner, repo) });
    },
  });
}

// ─── Edit / delete: issue body + issue comments ────────────────────────────

export function useUpdateIssue(owner: string, repo: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ issueNumber, body }: { issueNumber: number; body: string }) => {
      const client = getGitHubClient();
      const res = await client.request("PATCH /repos/{owner}/{repo}/issues/{issue_number}", {
        owner,
        repo,
        issue_number: issueNumber,
        body,
      });
      return IssueDetailSchema.parse(res.data);
    },
    onMutate: async ({ issueNumber, body }) => {
      const iKey = issueKeys.detail(owner, repo, issueNumber);
      const prev = queryClient.getQueryData<RepoIssue>(iKey);
      if (prev) {
        queryClient.setQueryData<RepoIssue>(iKey, {
          ...prev,
          body,
          updated_at: new Date().toISOString(),
        });
      }
      await queryClient.cancelQueries({ queryKey: iKey });
      return { prev, iKey };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(ctx.iKey, ctx.prev);
    },
    onSuccess: (updated, vars) => {
      queryClient.setQueryData(issueKeys.detail(owner, repo, vars.issueNumber), updated);
    },
  });
}

export function useUpdateIssueComment(owner: string, repo: string, issueNumber: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ commentId, body }: { commentId: number; body: string }) => {
      const client = getGitHubClient();
      const res = await client.request("PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}", {
        owner,
        repo,
        comment_id: commentId,
        body,
      });
      return IssueCommentSchema.parse(res.data);
    },
    onMutate: async ({ commentId, body }) => {
      const key = issueKeys.comments(owner, repo, issueNumber);
      const prev = queryClient.getQueryData<RepoIssueComment[]>(key);
      const nowIso = new Date().toISOString();
      queryClient.setQueryData<RepoIssueComment[]>(key, (old) =>
        (old ?? []).map((c) => (c.id === commentId ? { ...c, body, updated_at: nowIso } : c)),
      );
      await queryClient.cancelQueries({ queryKey: key });
      return { prev, key };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(ctx.key, ctx.prev);
    },
    onSuccess: (updated, _vars, ctx) => {
      if (ctx) {
        queryClient.setQueryData<RepoIssueComment[]>(ctx.key, (old) =>
          (old ?? []).map((c) => (c.id === updated.id ? updated : c)),
        );
      }
    },
  });
}

export function useDeleteIssueComment(owner: string, repo: string, issueNumber: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ commentId }: { commentId: number }) => {
      const client = getGitHubClient();
      await client.request("DELETE /repos/{owner}/{repo}/issues/comments/{comment_id}", {
        owner,
        repo,
        comment_id: commentId,
      });
      return commentId;
    },
    onMutate: async ({ commentId }) => {
      const key = issueKeys.comments(owner, repo, issueNumber);
      const prev = queryClient.getQueryData<RepoIssueComment[]>(key);
      queryClient.setQueryData<RepoIssueComment[]>(key, (old) =>
        (old ?? []).filter((c) => c.id !== commentId),
      );
      await queryClient.cancelQueries({ queryKey: key });
      return { prev, key };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(ctx.key, ctx.prev);
    },
  });
}
