import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  EMPTY_MY_REACTIONS,
  IssueCommentSchema,
  IssueCommentsSchema,
  IssueDetailSchema,
  IssueListSchema,
  type MyReactionsMap,
  type ReactionContent,
  ReactionListSchema,
  type RepoIssue,
  type RepoIssueComment,
} from "@/app/features/issues/schemas";
import { getGitHubClient } from "@/app/lib/github/client";
import { useAuthStore } from "@/app/stores/auth";

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
  myIssueReactions: (
    owner: string,
    repo: string,
    issueNumber: number | undefined,
    meId: number | undefined,
  ) => ["issue-my-reactions", owner, repo, issueNumber, meId] as const,
  myCommentReactions: (
    owner: string,
    repo: string,
    commentId: number,
    meId: number | undefined,
  ) => ["comment-my-reactions", owner, repo, commentId, meId] as const,
};

// ─── Queries ────────────────────────────────────────────────────────────────

export function useRepoIssues(owner: string, repo: string) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: issueKeys.all(owner, repo),
    enabled: !!token && !!owner && !!repo,
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
}

export function useRepoIssue(owner: string, repo: string, issueNumber: number | undefined) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: issueKeys.detail(owner, repo, issueNumber),
    enabled: !!token && !!owner && !!repo && !!issueNumber,
    queryFn: async (): Promise<RepoIssue> => {
      const client = getGitHubClient();
      const res = await client.request("GET /repos/{owner}/{repo}/issues/{issue_number}", {
        owner,
        repo,
        // enabled guard ensures issueNumber is defined
        issue_number: issueNumber!,
      });
      return IssueDetailSchema.parse(res.data);
    },
  });
}

export function useRepoIssueComments(owner: string, repo: string, issueNumber: number | undefined) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: issueKeys.comments(owner, repo, issueNumber),
    enabled: !!token && !!owner && !!repo && !!issueNumber,
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

// "My reactions" — content → reactionId map for the logged-in viewer.
// Needed so the UI can (a) highlight pills we've reacted to and (b) DELETE
// by id to toggle off without guessing.

function buildMyMap(
  reactions: Array<{ id: number; content: ReactionContent; user: { id: number } | null }>,
  meId: number,
): MyReactionsMap {
  const map: MyReactionsMap = new Map();
  for (const r of reactions) {
    if (r.user?.id === meId) map.set(r.content, r.id);
  }
  return map;
}

export function useMyIssueReactions(
  owner: string,
  repo: string,
  issueNumber: number | undefined,
  meId: number | undefined,
) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: issueKeys.myIssueReactions(owner, repo, issueNumber, meId),
    enabled: !!token && !!owner && !!repo && !!issueNumber && !!meId,
    staleTime: 60_000,
    queryFn: async (): Promise<MyReactionsMap> => {
      const client = getGitHubClient();
      const res = await client.request(
        "GET /repos/{owner}/{repo}/issues/{issue_number}/reactions",
        {
          owner,
          repo,
          issue_number: issueNumber!,
          per_page: 100,
          headers: { accept: "application/vnd.github+json" },
        },
      );
      return buildMyMap(ReactionListSchema.parse(res.data), meId as number);
    },
  });
}

export function useMyCommentReactions(
  owner: string,
  repo: string,
  commentId: number,
  meId: number | undefined,
) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: issueKeys.myCommentReactions(owner, repo, commentId, meId),
    // Optimistic temp comments have negative ids — skip the fetch for those
    enabled: !!token && !!owner && !!repo && commentId > 0 && !!meId,
    staleTime: 60_000,
    queryFn: async (): Promise<MyReactionsMap> => {
      const client = getGitHubClient();
      const res = await client.request(
        "GET /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions",
        {
          owner,
          repo,
          comment_id: commentId,
          per_page: 100,
          headers: { accept: "application/vnd.github+json" },
        },
      );
      return buildMyMap(ReactionListSchema.parse(res.data), meId as number);
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
    mutationFn: async ({ issueNumber: n, body }: { issueNumber: number; body: string }) => {
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
    onSuccess: (created, _vars, ctx) => {
      // Swap temp → real in place, no refetch round-trip needed
      if (ctx) {
        queryClient.setQueryData<RepoIssueComment[]>(ctx.key, (old) =>
          (old ?? []).map((c) => (c.id === ctx.tempId ? created : c)),
        );
      }
    },
    onSettled: (_data, _err, vars) => {
      // Resync the issue's comment count (shown in the detail header + list row)
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
      await queryClient.cancelQueries({ queryKey: iKey });
      await queryClient.cancelQueries({ queryKey: listKey });
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
      return { prevIssue, prevList, iKey, listKey };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevIssue) queryClient.setQueryData(ctx.iKey, ctx.prevIssue);
      if (ctx?.prevList) queryClient.setQueryData(ctx.listKey, ctx.prevList);
    },
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({ queryKey: issueKeys.all(owner, repo) });
      queryClient.invalidateQueries({ queryKey: issueKeys.detail(owner, repo, vars.issueNumber) });
    },
  });
}

/**
 * Toggle an issue-level reaction. Optimistic path:
 *   1. Flip count in the issue cache (+1 or -1)
 *   2. Flip my-reactions map entry (set → placeholder id / delete)
 *   3. onSuccess writes the real reaction id back
 *   4. onSettled runs a cheap invalidation to reconcile
 */
export function useToggleIssueReaction(
  owner: string,
  repo: string,
  meId: number | undefined,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      issueNumber,
      content,
      existingReactionId,
    }: {
      issueNumber: number;
      content: ReactionContent;
      existingReactionId?: number;
    }) => {
      const client = getGitHubClient();
      if (existingReactionId && existingReactionId > 0) {
        await client.request(
          "DELETE /repos/{owner}/{repo}/issues/{issue_number}/reactions/{reaction_id}",
          {
            owner,
            repo,
            issue_number: issueNumber,
            reaction_id: existingReactionId,
            headers: { accept: "application/vnd.github+json" },
          },
        );
        return { newReactionId: null as number | null, content };
      }
      const res = await client.request(
        "POST /repos/{owner}/{repo}/issues/{issue_number}/reactions",
        {
          owner,
          repo,
          issue_number: issueNumber,
          content,
          headers: { accept: "application/vnd.github+json" },
        },
      );
      return { newReactionId: (res.data as { id: number }).id, content };
    },
    onMutate: async ({ issueNumber, content, existingReactionId }) => {
      const iKey = issueKeys.detail(owner, repo, issueNumber);
      const myKey = issueKeys.myIssueReactions(owner, repo, issueNumber, meId);
      await queryClient.cancelQueries({ queryKey: iKey });
      await queryClient.cancelQueries({ queryKey: myKey });
      const prevIssue = queryClient.getQueryData<RepoIssue>(iKey);
      const prevMy = queryClient.getQueryData<MyReactionsMap>(myKey);
      const delta = existingReactionId ? -1 : 1;

      if (prevIssue) {
        queryClient.setQueryData<RepoIssue>(iKey, {
          ...prevIssue,
          reactions: {
            ...prevIssue.reactions,
            [content]: Math.max(0, (prevIssue.reactions[content] ?? 0) + delta),
          },
        });
      }
      const nextMy: MyReactionsMap = new Map(prevMy ?? EMPTY_MY_REACTIONS);
      if (existingReactionId) nextMy.delete(content);
      else nextMy.set(content, -Date.now()); // placeholder until POST returns
      queryClient.setQueryData(myKey, nextMy);

      return { prevIssue, prevMy, iKey, myKey };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevIssue) queryClient.setQueryData(ctx.iKey, ctx.prevIssue);
      if (ctx?.prevMy !== undefined) queryClient.setQueryData(ctx.myKey, ctx.prevMy);
    },
    onSuccess: (data, vars, ctx) => {
      // Write the real reaction id so a second click knows how to DELETE
      // without waiting for a full refetch.
      if (!ctx) return;
      const current = queryClient.getQueryData<MyReactionsMap>(ctx.myKey);
      if (!current) return;
      const next = new Map(current);
      if (data.newReactionId) next.set(vars.content, data.newReactionId);
      else next.delete(vars.content);
      queryClient.setQueryData(ctx.myKey, next);
    },
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({ queryKey: issueKeys.detail(owner, repo, vars.issueNumber) });
      queryClient.invalidateQueries({
        queryKey: issueKeys.myIssueReactions(owner, repo, vars.issueNumber, meId),
      });
    },
  });
}

export function useToggleCommentReaction(
  owner: string,
  repo: string,
  issueNumber: number | undefined,
  meId: number | undefined,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      commentId,
      content,
      existingReactionId,
    }: {
      commentId: number;
      content: ReactionContent;
      existingReactionId?: number;
    }) => {
      const client = getGitHubClient();
      if (existingReactionId && existingReactionId > 0) {
        await client.request(
          "DELETE /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions/{reaction_id}",
          {
            owner,
            repo,
            comment_id: commentId,
            reaction_id: existingReactionId,
            headers: { accept: "application/vnd.github+json" },
          },
        );
        return { newReactionId: null as number | null, content };
      }
      const res = await client.request(
        "POST /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions",
        {
          owner,
          repo,
          comment_id: commentId,
          content,
          headers: { accept: "application/vnd.github+json" },
        },
      );
      return { newReactionId: (res.data as { id: number }).id, content };
    },
    onMutate: async ({ commentId, content, existingReactionId }) => {
      const key = issueKeys.comments(owner, repo, issueNumber);
      const myKey = issueKeys.myCommentReactions(owner, repo, commentId, meId);
      await queryClient.cancelQueries({ queryKey: key });
      await queryClient.cancelQueries({ queryKey: myKey });
      const prevList = queryClient.getQueryData<RepoIssueComment[]>(key);
      const prevMy = queryClient.getQueryData<MyReactionsMap>(myKey);
      const delta = existingReactionId ? -1 : 1;

      if (prevList) {
        queryClient.setQueryData<RepoIssueComment[]>(
          key,
          prevList.map((c) =>
            c.id === commentId
              ? {
                  ...c,
                  reactions: {
                    ...c.reactions,
                    [content]: Math.max(0, (c.reactions[content] ?? 0) + delta),
                  },
                }
              : c,
          ),
        );
      }
      const nextMy: MyReactionsMap = new Map(prevMy ?? EMPTY_MY_REACTIONS);
      if (existingReactionId) nextMy.delete(content);
      else nextMy.set(content, -Date.now());
      queryClient.setQueryData(myKey, nextMy);

      return { prevList, prevMy, key, myKey };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevList) queryClient.setQueryData(ctx.key, ctx.prevList);
      if (ctx?.prevMy !== undefined) queryClient.setQueryData(ctx.myKey, ctx.prevMy);
    },
    onSuccess: (data, vars, ctx) => {
      if (!ctx) return;
      const current = queryClient.getQueryData<MyReactionsMap>(ctx.myKey);
      if (!current) return;
      const next = new Map(current);
      if (data.newReactionId) next.set(vars.content, data.newReactionId);
      else next.delete(vars.content);
      queryClient.setQueryData(ctx.myKey, next);
    },
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({ queryKey: issueKeys.comments(owner, repo, issueNumber) });
      queryClient.invalidateQueries({
        queryKey: issueKeys.myCommentReactions(owner, repo, vars.commentId, meId),
      });
    },
  });
}
