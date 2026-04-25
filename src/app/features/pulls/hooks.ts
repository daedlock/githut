import {
  infiniteQueryOptions,
  queryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { z } from "zod";
import { getGitHubClient } from "@/app/lib/github/client";
import { useAuthStore } from "@/app/stores/auth";
import {
  IssueCommentOnPrSchema,
  PrFileSchema,
  PullRequestSchema,
  ReviewCommentSchema,
  ReviewSchema,
  TimelineEventSchema,
  type IssueCommentOnPr,
  type PrFile,
  type PullRequest,
  type Review,
  type ReviewComment,
  type TimelineEvent,
} from "@/app/features/pulls/schemas";
import { toUiState, isLive as isStateLive } from "@/app/features/pulls/lib/prStatus";

// ─── PR-list schema (search API `items` shape) ─────────────────────────────
//
// GitHub's `/search/issues` + `is:pr` returns an "issue-shaped" row with a
// nested `pull_request` object. That's enough for the list UI (state,
// draft, merged_at, labels, author, counts). Full PR shape (head/base
// refs, mergeable, changed_files, ...) is fetched on demand from the
// detail page via `/repos/{o}/{r}/pulls/{n}`.

const UserLite = z
  .object({ login: z.string(), avatar_url: z.string(), html_url: z.string().optional() })
  .nullable();

export const PrListItemSchema = z.object({
  id: z.number(),
  number: z.number(),
  title: z.string(),
  html_url: z.string(),
  state: z.enum(["open", "closed"]),
  draft: z.boolean().optional().default(false),
  created_at: z.string(),
  updated_at: z.string(),
  closed_at: z.string().nullable().optional(),
  comments: z.number(),
  user: UserLite,
  labels: z
    .array(
      z.object({
        id: z.number(),
        name: z.string(),
        color: z.string(),
        description: z.string().nullable().optional(),
      }),
    )
    .default([]),
  assignees: z.array(z.object({ login: z.string(), avatar_url: z.string() })).default([]),
  pull_request: z
    .object({
      url: z.string(),
      merged_at: z.string().nullable().optional(),
      // Search doesn't surface full refs; detail does.
    })
    .nullable()
    .optional(),
});
export type PrListItem = z.infer<typeof PrListItemSchema>;

const PrSearchResponseSchema = z.object({
  total_count: z.number(),
  incomplete_results: z.boolean(),
  items: z.array(PrListItemSchema),
});

// ─── Keys ──────────────────────────────────────────────────────────────────

export const pullsKeys = {
  list: (owner: string, repo: string, filters: PullsFilters) =>
    ["pulls-list", owner, repo, normalizeFilters(filters)] as const,
  counts: (owner: string, repo: string) => ["pulls-counts", owner, repo] as const,
  detail: (owner: string, repo: string, number: number) =>
    ["pulls-detail", owner, repo, number] as const,
  comments: (owner: string, repo: string, number: number) =>
    ["pulls-comments", owner, repo, number] as const,
  reviews: (owner: string, repo: string, number: number) =>
    ["pulls-reviews", owner, repo, number] as const,
  timeline: (owner: string, repo: string, number: number) =>
    ["pulls-timeline", owner, repo, number] as const,
  files: (owner: string, repo: string, number: number) =>
    ["pulls-files", owner, repo, number] as const,
  commits: (owner: string, repo: string, number: number) =>
    ["pulls-commits", owner, repo, number] as const,
  checks: (owner: string, repo: string, sha: string) =>
    ["pulls-checks", owner, repo, sha] as const,
  reviewComments: (owner: string, repo: string, number: number) =>
    ["pulls-review-comments", owner, repo, number] as const,
};

// ─── Filters ───────────────────────────────────────────────────────────────

export type PullsSort = "newest" | "oldest" | "updated" | "comments";
export type PullsState = "open" | "closed" | "all";

export type PullsFilters = {
  state?: PullsState;
  author?: string;
  label?: string; // single label for now; multi comes with label picker in P9
  reviewer?: string;
  assignee?: string;
  sort?: PullsSort;
};

function normalizeFilters(f: PullsFilters): string {
  const entries = Object.entries(f)
    .filter(([, v]) => v !== undefined && v !== "" && v !== "all")
    .sort(([a], [b]) => a.localeCompare(b));
  return entries.length === 0 ? "default" : entries.map(([k, v]) => `${k}=${v}`).join("&");
}

/**
 * Build the GitHub Search query string. `repo:{owner}/{repo} is:pr` is the
 * base; filters concatenate with spaces. Each filter value is wrapped in
 * quotes so names with spaces (labels) and special chars don't fracture
 * the query.
 */
function buildSearchQuery(owner: string, repo: string, f: PullsFilters): string {
  const parts: string[] = [`repo:${owner}/${repo}`, "is:pr"];
  const state = f.state ?? "open";
  if (state === "open") parts.push("is:open");
  else if (state === "closed") parts.push("is:closed");
  // "all" → no state filter
  if (f.author) parts.push(`author:${f.author}`);
  if (f.label) parts.push(`label:"${f.label}"`);
  if (f.reviewer) parts.push(`reviewed-by:${f.reviewer}`);
  if (f.assignee) parts.push(`assignee:${f.assignee}`);
  return parts.join(" ");
}

/** Map UI sort key → Search API sort/order params. */
function sortParams(sort: PullsSort | undefined) {
  switch (sort) {
    case "oldest":
      return { sort: "created" as const, order: "asc" as const };
    case "updated":
      return { sort: "updated" as const, order: "desc" as const };
    case "comments":
      return { sort: "comments" as const, order: "desc" as const };
    case "newest":
    default:
      return { sort: "created" as const, order: "desc" as const };
  }
}

// ─── Infinite list ─────────────────────────────────────────────────────────

const PULLS_PER_PAGE = 30;

export const pullsQueryOptions = (
  owner: string,
  repo: string,
  filters: PullsFilters = {},
) =>
  infiniteQueryOptions({
    queryKey: pullsKeys.list(owner, repo, filters),
    staleTime: 30_000,
    initialPageParam: 1,
    getNextPageParam: (lastPage: PrListItem[], _all, lastParam) =>
      lastPage.length < PULLS_PER_PAGE ? undefined : (lastParam as number) + 1,
    queryFn: async ({ pageParam }): Promise<PrListItem[]> => {
      const client = getGitHubClient();
      const { sort, order } = sortParams(filters.sort);
      const res = await client.request("GET /search/issues", {
        q: buildSearchQuery(owner, repo, filters),
        sort,
        order,
        per_page: PULLS_PER_PAGE,
        page: pageParam as number,
      });
      return PrSearchResponseSchema.parse(res.data).items;
    },
  });

export function usePulls(owner: string, repo: string, filters: PullsFilters = {}) {
  const token = useAuthStore((s) => s.token);
  return useInfiniteQuery({
    ...pullsQueryOptions(owner, repo, filters),
    enabled: !!token && !!owner && !!repo,
  });
}

// ─── State-tab counts ──────────────────────────────────────────────────────
//
// Two tiny searches so the "Open / Closed" tabs can show GitHub-parity
// counters. Cached aggressively; each response is < 100 bytes so the
// ETag handshake dominates cost.

export const pullsCountsQueryOptions = (owner: string, repo: string) =>
  queryOptions({
    queryKey: pullsKeys.counts(owner, repo),
    staleTime: 60_000,
    queryFn: async (): Promise<{ open: number; closed: number }> => {
      const client = getGitHubClient();
      const [open, closed] = await Promise.all([
        client.request("GET /search/issues", {
          q: `repo:${owner}/${repo} is:pr is:open`,
          per_page: 1,
        }),
        client.request("GET /search/issues", {
          q: `repo:${owner}/${repo} is:pr is:closed`,
          per_page: 1,
        }),
      ]);
      return {
        open: (open.data as { total_count: number }).total_count,
        closed: (closed.data as { total_count: number }).total_count,
      };
    },
  });

export function usePullsCounts(owner: string, repo: string) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    ...pullsCountsQueryOptions(owner, repo),
    enabled: !!token && !!owner && !!repo,
  });
}

// ─── PR detail (full REST shape) ───────────────────────────────────────────
//
// Everything the detail header needs — title, state, draft/merged flags,
// head/base refs, mergeable state, body, counts. Polls while the PR is
// live so the header reflects merge-state changes + status-check results
// without a refresh.

export const prDetailQueryOptions = (owner: string, repo: string, number: number) =>
  queryOptions({
    queryKey: pullsKeys.detail(owner, repo, number),
    staleTime: 30_000,
    queryFn: async (): Promise<PullRequest> => {
      const client = getGitHubClient();
      const res = await client.request(
        "GET /repos/{owner}/{repo}/pulls/{pull_number}",
        { owner, repo, pull_number: number },
      );
      return PullRequestSchema.parse(res.data);
    },
  });

export function useFullPr(owner: string, repo: string, number: number) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    ...prDetailQueryOptions(owner, repo, number),
    enabled: !!token && !!owner && !!repo && Number.isFinite(number),
    refetchInterval: (q) => {
      const pr = q.state.data;
      if (!pr) return false;
      const ui = toUiState(pr);
      // Merge state and check-status can flip without user action (checks
      // complete, mergeability recomputes) — poll at 10s while live.
      return isStateLive(ui) ? 10_000 : false;
    },
    refetchIntervalInBackground: false,
  });
}

// ─── Conversation feed — issue comments, reviews, timeline ─────────────────
//
// GitHub's "Conversation" tab is the interleave of three endpoints. We
// fetch them separately so each can cache/invalidate on its own schedule
// and merge chronologically in the view layer (via `lib/mergeTimeline`).

const PrCommentsResponseSchema = z.array(IssueCommentOnPrSchema);
const PrReviewsResponseSchema = z.array(ReviewSchema);

export const prCommentsQueryOptions = (owner: string, repo: string, number: number) =>
  queryOptions({
    queryKey: pullsKeys.comments(owner, repo, number),
    staleTime: 15_000,
    queryFn: async (): Promise<IssueCommentOnPr[]> => {
      const client = getGitHubClient();
      // PR issue-level comments live under /issues/{n}/comments (PRs are
      // issues under the hood). Review comments on diff rows come from a
      // different endpoint and are fetched in P5.
      const res = await client.request(
        "GET /repos/{owner}/{repo}/issues/{issue_number}/comments",
        { owner, repo, issue_number: number, per_page: 100 },
      );
      const raw = Array.isArray(res.data) ? res.data : [];
      const comments: IssueCommentOnPr[] = [];
      for (const item of raw) {
        const result = IssueCommentOnPrSchema.safeParse(item);
        if (result.success) comments.push(result.data);
      }
      return comments;
    },
  });

export function usePrComments(owner: string, repo: string, number: number) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    ...prCommentsQueryOptions(owner, repo, number),
    enabled: !!token && !!owner && !!repo && Number.isFinite(number),
  });
}

export const prReviewsQueryOptions = (owner: string, repo: string, number: number) =>
  queryOptions({
    queryKey: pullsKeys.reviews(owner, repo, number),
    staleTime: 15_000,
    queryFn: async (): Promise<Review[]> => {
      const client = getGitHubClient();
      const res = await client.request(
        "GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews",
        { owner, repo, pull_number: number, per_page: 100 },
      );
      return PrReviewsResponseSchema.parse(res.data);
    },
  });

export function usePrReviews(owner: string, repo: string, number: number) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    ...prReviewsQueryOptions(owner, repo, number),
    enabled: !!token && !!owner && !!repo && Number.isFinite(number),
  });
}

export const prTimelineQueryOptions = (owner: string, repo: string, number: number) =>
  queryOptions({
    queryKey: pullsKeys.timeline(owner, repo, number),
    staleTime: 15_000,
    queryFn: async (): Promise<TimelineEvent[]> => {
      const client = getGitHubClient();
      const res = await client.request(
        "GET /repos/{owner}/{repo}/issues/{issue_number}/timeline",
        {
          owner,
          repo,
          issue_number: number,
          per_page: 100,
          headers: { accept: "application/vnd.github.mockingbird-preview+json" },
        },
      );
      const raw = Array.isArray(res.data) ? res.data : [];
      const events: TimelineEvent[] = [];
      for (const item of raw) {
        const result = TimelineEventSchema.safeParse(item);
        if (result.success) events.push(result.data);
      }
      return events;
    },
  });

export function usePrTimeline(owner: string, repo: string, number: number) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    ...prTimelineQueryOptions(owner, repo, number),
    enabled: !!token && !!owner && !!repo && Number.isFinite(number),
  });
}

// ─── Post PR comment (optimistic) ──────────────────────────────────────────
//
// Snapshot → temp row → swap on success → invalidate to rehydrate from server.
// The key insight: we must invalidate the comments query so the server shape
// becomes the source of truth after the mutation settles.

export function usePostPrComment(
  owner: string,
  repo: string,
  number: number,
  me: { id: number; login: string; avatar_url: string } | undefined,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ body }: { body: string }) => {
      const client = getGitHubClient();
      const res = await client.request(
        "POST /repos/{owner}/{repo}/issues/{issue_number}/comments",
        { owner, repo, issue_number: number, body },
      );
      return IssueCommentOnPrSchema.parse(res.data);
    },
    onMutate: async ({ body }) => {
      const key = pullsKeys.comments(owner, repo, number);
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<IssueCommentOnPr[]>(key);
      const tempId = -Date.now();
      const nowIso = new Date().toISOString();
      const optimistic: IssueCommentOnPr = {
        id: tempId,
        node_id: `temp-${tempId}`,
        url: "",
        html_url: "",
        body,
        created_at: nowIso,
        updated_at: nowIso,
        user: me
          ? { login: me.login, avatar_url: me.avatar_url, html_url: undefined }
          : null,
      };
      queryClient.setQueryData<IssueCommentOnPr[]>(key, (old) => [
        ...(old ?? []),
        optimistic,
      ]);
      return { prev, tempId, key };
    },
    onError: (_err, _vars, ctx) => {
      // Roll back to previous state on error
      if (ctx?.prev) queryClient.setQueryData(ctx.key, ctx.prev);
    },
    onSuccess: (created, _vars, ctx) => {
      // Replace temp comment with real one from server
      if (ctx) {
        queryClient.setQueryData<IssueCommentOnPr[]>(ctx.key, (old) =>
          (old ?? []).map((c) => (c.id === ctx.tempId ? created : c)),
        );
      }
    },
    onSettled: (_data, _error, _vars, ctx) => {
      // DO NOT invalidate comments - we already updated it in onSuccess
      // Only invalidate related queries that need counts/summaries
      queryClient.invalidateQueries({
        queryKey: pullsKeys.detail(owner, repo, number),
      });
      queryClient.invalidateQueries({
        queryKey: pullsKeys.timeline(owner, repo, number),
      });
    },
  });
}

// ─── PR files (diff) ───────────────────────────────────────────────────────
//
// One-shot fetch of the PR's changed-files list with patches inline. For
// very large PRs GitHub paginates with `per_page=100`; we take the first
// page and document the limit in the UI. (Full paging comes with the
// "load more files" affordance in P10.)

const PrFilesResponseSchema = z.array(PrFileSchema);

export const prFilesQueryOptions = (owner: string, repo: string, number: number) =>
  queryOptions({
    queryKey: pullsKeys.files(owner, repo, number),
    staleTime: 30_000,
    queryFn: async (): Promise<PrFile[]> => {
      const client = getGitHubClient();
      const res = await client.request(
        "GET /repos/{owner}/{repo}/pulls/{pull_number}/files",
        { owner, repo, pull_number: number, per_page: 100 },
      );
      return PrFilesResponseSchema.parse(res.data);
    },
  });

export function usePrFiles(owner: string, repo: string, number: number) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    ...prFilesQueryOptions(owner, repo, number),
    enabled: !!token && !!owner && !!repo && Number.isFinite(number),
  });
}

// ─── PR commits ────────────────────────────────────────────────────────────
//
// Commits in the PR (oldest → newest). Each entry has the same shape as
// the repo-wide commit summary so we reuse `CommitRow` for rendering.

const MaybeGitHubUser = z
  .object({
    login: z.string(),
    avatar_url: z.string(),
    html_url: z.string().optional(),
  })
  .nullable();

const PrCommitSchema = z.object({
  sha: z.string(),
  html_url: z.string(),
  commit: z.object({
    author: z.object({
      name: z.string(),
      email: z.string(),
      date: z.string(),
    }),
    committer: z.object({
      name: z.string(),
      email: z.string(),
      date: z.string(),
    }),
    message: z.string(),
  }),
  author: MaybeGitHubUser,
  committer: MaybeGitHubUser,
  parents: z.array(z.object({ sha: z.string(), html_url: z.string() })),
});
export type PrCommit = z.infer<typeof PrCommitSchema>;

const PrCommitsResponseSchema = z.array(PrCommitSchema);

export const prCommitsQueryOptions = (owner: string, repo: string, number: number) =>
  queryOptions({
    queryKey: pullsKeys.commits(owner, repo, number),
    staleTime: 30_000,
    queryFn: async (): Promise<PrCommit[]> => {
      const client = getGitHubClient();
      const res = await client.request(
        "GET /repos/{owner}/{repo}/pulls/{pull_number}/commits",
        { owner, repo, pull_number: number, per_page: 100 },
      );
      return PrCommitsResponseSchema.parse(res.data);
    },
  });

export function usePrCommits(owner: string, repo: string, number: number) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    ...prCommitsQueryOptions(owner, repo, number),
    enabled: !!token && !!owner && !!repo && Number.isFinite(number),
  });
}

// ─── Checks / statuses (keyed on PR head SHA) ──────────────────────────────
//
// Two legacy surfaces exist:
//   • `/commits/{sha}/check-runs` — modern (GitHub Actions + third-party
//     Check Runs). This is where most status flows now.
//   • `/commits/{sha}/status` — legacy "combined status" (Travis-era
//     contexts). Still used by many providers for the single green/red
//     rollup.
// We fetch both and unify at the view layer: a CheckRun carries the
// granular per-job result; the combined status rolls the remaining
// providers into one row. Polls while non-terminal so the UI updates as
// runs complete.

const CheckRunSchema = z.object({
  id: z.number(),
  name: z.string(),
  status: z.enum(["queued", "in_progress", "completed", "waiting", "pending"]),
  conclusion: z
    .enum([
      "success",
      "failure",
      "neutral",
      "cancelled",
      "skipped",
      "timed_out",
      "action_required",
      "stale",
    ])
    .nullable(),
  started_at: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
  html_url: z.string().nullable().optional(),
  details_url: z.string().nullable().optional(),
  app: z
    .object({
      name: z.string(),
      slug: z.string().optional(),
      owner: z
        .object({ login: z.string(), avatar_url: z.string() })
        .nullable()
        .optional(),
    })
    .nullable()
    .optional(),
  output: z
    .object({
      title: z.string().nullable().optional(),
      summary: z.string().nullable().optional(),
    })
    .optional(),
});
export type CheckRun = z.infer<typeof CheckRunSchema>;

const CheckRunsResponseSchema = z.object({
  total_count: z.number(),
  check_runs: z.array(CheckRunSchema),
});

const CombinedStatusSchema = z.object({
  state: z.enum(["pending", "success", "failure", "error"]),
  total_count: z.number(),
  statuses: z.array(
    z.object({
      id: z.number(),
      state: z.enum(["pending", "success", "failure", "error"]),
      context: z.string(),
      description: z.string().nullable(),
      target_url: z.string().nullable(),
      avatar_url: z.string().nullable().optional(),
      created_at: z.string(),
      updated_at: z.string(),
    }),
  ),
});
export type CombinedStatus = z.infer<typeof CombinedStatusSchema>;

export type PrChecksData = {
  checkRuns: CheckRun[];
  combined: CombinedStatus;
};

export const prChecksQueryOptions = (owner: string, repo: string, sha: string) =>
  queryOptions({
    queryKey: pullsKeys.checks(owner, repo, sha),
    staleTime: 10_000,
    queryFn: async (): Promise<PrChecksData> => {
      const client = getGitHubClient();
      const [runsRes, statusRes] = await Promise.all([
        client.request("GET /repos/{owner}/{repo}/commits/{ref}/check-runs", {
          owner,
          repo,
          ref: sha,
          per_page: 100,
        }),
        client.request("GET /repos/{owner}/{repo}/commits/{ref}/status", {
          owner,
          repo,
          ref: sha,
        }),
      ]);
      return {
        checkRuns: CheckRunsResponseSchema.parse(runsRes.data).check_runs,
        combined: CombinedStatusSchema.parse(statusRes.data),
      };
    },
  });

export function usePrChecks(owner: string, repo: string, sha: string | undefined) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    ...prChecksQueryOptions(owner, repo, sha ?? ""),
    enabled: !!token && !!owner && !!repo && !!sha,
    refetchInterval: (q) => {
      const data = q.state.data;
      if (!data) return false;
      const anyLive =
        data.checkRuns.some(
          (r) => r.status === "queued" || r.status === "in_progress" || r.status === "pending",
        ) || data.combined.state === "pending";
      return anyLive ? 10_000 : false;
    },
    refetchIntervalInBackground: false,
  });
}

// ─── PR lifecycle actions ──────────────────────────────────────────────────
//
// Close / reopen / merge via REST; draft toggles via GraphQL (REST
// doesn't support flipping the draft flag post-creation). All writes
// optimistically patch the PR detail cache so the header flips state
// instantly, then invalidate on settle so the server's shape wins.

export type MergeMethod = "merge" | "squash" | "rebase";

export function useMergePr(owner: string, repo: string, number: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      method: MergeMethod;
      commitTitle?: string;
      commitMessage?: string;
    }) => {
      const client = getGitHubClient();
      const res = await client.request(
        "PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge",
        {
          owner,
          repo,
          pull_number: number,
          merge_method: vars.method,
          commit_title: vars.commitTitle,
          commit_message: vars.commitMessage,
        },
      );
      return res.data as { sha: string; merged: boolean; message: string };
    },
    onMutate: async () => {
      const key = pullsKeys.detail(owner, repo, number);
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<PullRequest>(key);
      if (prev) {
        queryClient.setQueryData<PullRequest>(key, {
          ...prev,
          state: "closed",
          merged: true,
          merged_at: new Date().toISOString(),
        });
      }
      return { key, prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: pullsKeys.detail(owner, repo, number),
      });
      queryClient.invalidateQueries({
        queryKey: pullsKeys.timeline(owner, repo, number),
      });
      queryClient.invalidateQueries({ queryKey: pullsKeys.counts(owner, repo) });
    },
  });
}

export function useTogglePrState(owner: string, repo: string, number: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ state }: { state: "open" | "closed" }) => {
      const client = getGitHubClient();
      const res = await client.request(
        "PATCH /repos/{owner}/{repo}/pulls/{pull_number}",
        { owner, repo, pull_number: number, state },
      );
      return PullRequestSchema.parse(res.data);
    },
    onMutate: async ({ state }) => {
      const key = pullsKeys.detail(owner, repo, number);
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<PullRequest>(key);
      if (prev) {
        queryClient.setQueryData<PullRequest>(key, {
          ...prev,
          state,
          closed_at:
            state === "closed" ? new Date().toISOString() : null,
        });
      }
      return { key, prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: pullsKeys.detail(owner, repo, number),
      });
      queryClient.invalidateQueries({
        queryKey: pullsKeys.timeline(owner, repo, number),
      });
      queryClient.invalidateQueries({ queryKey: pullsKeys.counts(owner, repo) });
    },
  });
}

// ─── Submit a review (top-level approve / request-changes / comment) ──────
//
// Posts a fresh review with a body and an event. The inline comments
// flow (P5) uses the same endpoint with a `comments` array payload.

export type ReviewEvent = "APPROVE" | "REQUEST_CHANGES" | "COMMENT";

export function useSubmitPrReview(owner: string, repo: string, number: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      event,
      body,
      comments,
    }: {
      event: ReviewEvent;
      body?: string;
      comments?: Array<{
        path: string;
        line: number;
        side: "LEFT" | "RIGHT";
        body: string;
      }>;
    }) => {
      const client = getGitHubClient();
      const res = await client.request(
        "POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews",
        {
          owner,
          repo,
          pull_number: number,
          event,
          body: body?.trim() || undefined,
          comments: comments?.length ? comments : undefined,
        },
      );
      return ReviewSchema.parse(res.data);
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: pullsKeys.reviews(owner, repo, number),
      });
      queryClient.invalidateQueries({
        queryKey: pullsKeys.timeline(owner, repo, number),
      });
      queryClient.invalidateQueries({
        queryKey: pullsKeys.detail(owner, repo, number),
      });
      queryClient.invalidateQueries({
        queryKey: pullsKeys.reviewComments(owner, repo, number),
      });
    },
  });
}

export function useSetPrDraft(owner: string, repo: string, number: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ draft, nodeId }: { draft: boolean; nodeId: string }) => {
      const client = getGitHubClient();
      // REST doesn't expose the draft flip post-creation; GraphQL does.
      const mutation = draft
        ? `mutation($id: ID!) {
            convertPullRequestToDraft(input: { pullRequestId: $id }) {
              pullRequest { id isDraft }
            }
          }`
        : `mutation($id: ID!) {
            markPullRequestReadyForReview(input: { pullRequestId: $id }) {
              pullRequest { id isDraft }
            }
          }`;
      return client.graphql(mutation, { id: nodeId });
    },
    onMutate: async ({ draft }) => {
      const key = pullsKeys.detail(owner, repo, number);
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<PullRequest>(key);
      if (prev) {
        queryClient.setQueryData<PullRequest>(key, { ...prev, draft });
      }
      return { key, prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: pullsKeys.detail(owner, repo, number),
      });
      queryClient.invalidateQueries({
        queryKey: pullsKeys.timeline(owner, repo, number),
      });
    },
  });
}

// ─── Inline review comments ────────────────────────────────────────────────
//
// The `/pulls/{n}/comments` endpoint returns a flat list of per-line
// review comments; threads are reconstructed client-side via
// `in_reply_to_id`. We ship view + reply in P5; brand-new-line comments
// arrive once the diff view supports picking a line.

const ReviewCommentsResponseSchema = z.array(ReviewCommentSchema);

export const prReviewCommentsQueryOptions = (
  owner: string,
  repo: string,
  number: number,
) =>
  queryOptions({
    queryKey: pullsKeys.reviewComments(owner, repo, number),
    staleTime: 15_000,
    queryFn: async (): Promise<ReviewComment[]> => {
      const client = getGitHubClient();
      const res = await client.request(
        "GET /repos/{owner}/{repo}/pulls/{pull_number}/comments",
        { owner, repo, pull_number: number, per_page: 100 },
      );
      return ReviewCommentsResponseSchema.parse(res.data);
    },
  });

export function usePrReviewComments(owner: string, repo: string, number: number) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    ...prReviewCommentsQueryOptions(owner, repo, number),
    enabled: !!token && !!owner && !!repo && Number.isFinite(number),
  });
}

export function useReplyToReviewComment(
  owner: string,
  repo: string,
  number: number,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      inReplyToId,
      body,
    }: {
      inReplyToId: number;
      body: string;
    }) => {
      const client = getGitHubClient();
      const res = await client.request(
        "POST /repos/{owner}/{repo}/pulls/{pull_number}/comments/{comment_id}/replies",
        {
          owner,
          repo,
          pull_number: number,
          comment_id: inReplyToId,
          body,
        },
      );
      return ReviewCommentSchema.parse(res.data);
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: pullsKeys.reviewComments(owner, repo, number),
      });
    },
  });
}

