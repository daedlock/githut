import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  IssueCommentSchema,
  IssueCommentsSchema,
  IssueDetailSchema,
  IssueListSchema,
  type ReactionContent,
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

// ─── Mutations ──────────────────────────────────────────────────────────────

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
      // Matches prior behavior: invalidate all detail entries for this repo
      // so any cached stale single-issue views refetch on next open.
      await queryClient.invalidateQueries({ queryKey: ["repo-issue", owner, repo] });
    },
  });
}

export function useCreateIssueComment(
  owner: string,
  repo: string,
  issueNumber: number | undefined,
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
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: issueKeys.comments(owner, repo, issueNumber),
      });
      await queryClient.invalidateQueries({
        queryKey: issueKeys.detail(owner, repo, issueNumber),
      });
      await queryClient.invalidateQueries({ queryKey: issueKeys.all(owner, repo) });
    },
  });
}

export function useUpdateIssueState(owner: string, repo: string, issueNumber: number | undefined) {
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
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: issueKeys.all(owner, repo) });
      await queryClient.invalidateQueries({
        queryKey: issueKeys.detail(owner, repo, issueNumber),
      });
    },
  });
}

export function useAddIssueReaction(owner: string, repo: string, issueNumber: number | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      issueNumber: n,
      content,
    }: {
      issueNumber: number;
      content: ReactionContent;
    }) => {
      const client = getGitHubClient();
      await client.request("POST /repos/{owner}/{repo}/issues/{issue_number}/reactions", {
        owner,
        repo,
        issue_number: n,
        content,
        headers: { accept: "application/vnd.github+json" },
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: issueKeys.detail(owner, repo, issueNumber),
      });
    },
  });
}

export function useAddCommentReaction(
  owner: string,
  repo: string,
  issueNumber: number | undefined,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ commentId, content }: { commentId: number; content: ReactionContent }) => {
      const client = getGitHubClient();
      await client.request("POST /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions", {
        owner,
        repo,
        comment_id: commentId,
        content,
        headers: { accept: "application/vnd.github+json" },
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: issueKeys.comments(owner, repo, issueNumber),
      });
    },
  });
}
