import {
  infiniteQueryOptions,
  queryOptions,
  useInfiniteQuery,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { z } from "zod";
import {
  type ReviewDecision as AggregatedReviewDecision,
  aggregateReviews,
} from "@/app/features/pulls/lib/reviewDecision";
import {
  type IssueCommentOnPr,
  IssueCommentOnPrSchema,
  type PrFile,
  PrFileSchema,
  type PullRequest,
  PullRequestSchema,
  type Review,
  type ReviewComment,
  ReviewCommentSchema,
  ReviewSchema,
  type TimelineEvent,
  TimelineEventSchema,
} from "@/app/features/pulls/schemas";
import { getGitHubClient } from "@/app/lib/github/client";
import { useAuthStore } from "@/app/stores/auth";

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
  all: ["pulls"] as const,

  lists: (owner: string, repo: string) => [...pullsKeys.all, "list", owner, repo] as const,
  list: (owner: string, repo: string, filters: PullsFilters) =>
    [...pullsKeys.lists(owner, repo), normalizeFilters(filters)] as const,

  counts: (owner: string, repo: string) => [...pullsKeys.all, "counts", owner, repo] as const,

  detail: (owner: string, repo: string, number: number) =>
    [...pullsKeys.all, "detail", owner, repo, number] as const,
  comments: (owner: string, repo: string, number: number) =>
    [...pullsKeys.all, "comments", owner, repo, number] as const,
  reviews: (owner: string, repo: string, number: number) =>
    [...pullsKeys.all, "reviews", owner, repo, number] as const,
  timeline: (owner: string, repo: string, number: number) =>
    [...pullsKeys.all, "timeline", owner, repo, number] as const,
  files: (owner: string, repo: string, number: number) =>
    [...pullsKeys.all, "files", owner, repo, number] as const,
  commits: (owner: string, repo: string, number: number) =>
    [...pullsKeys.all, "commits", owner, repo, number] as const,
  checks: (owner: string, repo: string, sha: string) =>
    [...pullsKeys.all, "checks", owner, repo, sha] as const,
  checkRollup: (owner: string, repo: string, number: number) =>
    [...pullsKeys.all, "check-rollup", owner, repo, number] as const,
  mergeStatus: (owner: string, repo: string, number: number) =>
    [...pullsKeys.all, "merge-status", owner, repo, number] as const,
  reviewComments: (owner: string, repo: string, number: number) =>
    [...pullsKeys.all, "review-comments", owner, repo, number] as const,
  threadResolution: (owner: string, repo: string, number: number) =>
    [...pullsKeys.all, "thread-resolution", owner, repo, number] as const,
  branchRefs: (owner: string, repo: string, number: number) =>
    [...pullsKeys.all, "branch-refs", owner, repo, number] as const,
};

// ─── Filters ───────────────────────────────────────────────────────────────

export type PullsSort = "newest" | "oldest" | "updated" | "comments";
export type PullsState = "open" | "closed" | "all";

export type PullsFilters = {
  state?: PullsState;
  draft?: "true" | "false";
  author?: string[];
  label?: string[];
  reviewer?: string[];
  assignee?: string[];
  excludeAuthor?: string[];
  excludeLabel?: string[];
  excludeReviewer?: string[];
  excludeAssignee?: string[];
  sort?: PullsSort;
};

function normalizeFilters(f: PullsFilters): string {
  const entries = Object.entries(f)
    .filter(([, v]) => {
      if (v === undefined || v === "all") return false;
      if (Array.isArray(v) && v.length === 0) return false;
      return true;
    })
    .sort(([a], [b]) => a.localeCompare(b));
  return entries.length === 0
    ? "default"
    : entries.map(([k, v]) => `${k}=${Array.isArray(v) ? v.join(",") : v}`).join("&");
}

/**
 * Build the GitHub Search query string. `repo:{owner}/{repo} is:pr` is the
 * base; filters concatenate with spaces. Each filter value is wrapped in
 * quotes so names with spaces (labels) and special chars don't fracture
 * the query. Multi-value fields emit one qualifier per value (AND).
 */
function buildSearchQuery(owner: string, repo: string, f: PullsFilters): string {
  const parts: string[] = [`repo:${owner}/${repo}`, "is:pr"];
  const state = f.state ?? "open";
  if (state === "open") parts.push("is:open");
  else if (state === "closed") parts.push("is:closed");
  if (f.draft === "true") parts.push("draft:true");
  else if (f.draft === "false") parts.push("draft:false");
  for (const v of f.author ?? []) parts.push(`author:${v}`);
  for (const v of f.excludeAuthor ?? []) parts.push(`-author:${v}`);
  for (const v of f.label ?? []) parts.push(`label:"${v}"`);
  for (const v of f.excludeLabel ?? []) parts.push(`-label:"${v}"`);
  for (const v of f.reviewer ?? []) parts.push(`reviewed-by:${v}`);
  for (const v of f.excludeReviewer ?? []) parts.push(`-reviewed-by:${v}`);
  for (const v of f.assignee ?? []) parts.push(`assignee:${v}`);
  for (const v of f.excludeAssignee ?? []) parts.push(`-assignee:${v}`);
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
    default:
      return { sort: "created" as const, order: "desc" as const };
  }
}

// ─── Infinite list ─────────────────────────────────────────────────────────

const PULLS_PER_PAGE = 30;

export const pullsQueryOptions = (owner: string, repo: string, filters: PullsFilters = {}) =>
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
      const res = await client.request("GET /repos/{owner}/{repo}/pulls/{pull_number}", {
        owner,
        repo,
        pull_number: number,
      });
      return PullRequestSchema.parse(res.data);
    },
  });

export function useFullPr(owner: string, repo: string, number: number) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    ...prDetailQueryOptions(owner, repo, number),
    enabled: !!token && !!owner && !!repo && Number.isFinite(number),
  });
}

// ─── Conversation feed — issue comments, reviews, timeline ─────────────────
//
// GitHub's "Conversation" tab is the interleave of three endpoints. We
// fetch them separately so each can cache/invalidate on its own schedule
// and merge chronologically in the view layer (via `lib/mergeTimeline`).

const PrReviewsResponseSchema = z.array(ReviewSchema);

type PaginatedResponse = {
  data: unknown;
  headers: { link?: string };
};

function hasNextPage(link: string | undefined): boolean {
  return typeof link === "string" && /rel="next"/.test(link);
}

async function fetchAllPages<T>(
  fetchPage: (page: number) => Promise<PaginatedResponse>,
  parsePage: (data: unknown) => T[],
): Promise<T[]> {
  const out: T[] = [];
  let page = 1;
  while (true) {
    const res = await fetchPage(page);
    out.push(...parsePage(res.data));
    if (!hasNextPage(res.headers.link)) return out;
    page++;
  }
}

export const prCommentsQueryOptions = (owner: string, repo: string, number: number) =>
  queryOptions({
    queryKey: pullsKeys.comments(owner, repo, number),
    staleTime: 15_000,
    queryFn: async (): Promise<IssueCommentOnPr[]> => {
      const client = getGitHubClient();
      // PR issue-level comments live under /issues/{n}/comments (PRs are
      // issues under the hood). Review comments on diff rows come from a
      // different endpoint and are fetched in P5.
      return fetchAllPages(
        (page) =>
          client.request("GET /repos/{owner}/{repo}/issues/{issue_number}/comments", {
            owner,
            repo,
            issue_number: number,
            per_page: 100,
            page,
          }),
        (data) => {
          const raw = Array.isArray(data) ? data : [];
          const comments: IssueCommentOnPr[] = [];
          for (const item of raw) {
            const result = IssueCommentOnPrSchema.safeParse(item);
            if (result.success) comments.push(result.data);
          }
          return comments;
        },
      );
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
      return fetchAllPages(
        (page) =>
          client.request("GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews", {
            owner,
            repo,
            pull_number: number,
            per_page: 100,
            page,
          }),
        (data) => PrReviewsResponseSchema.parse(data),
      );
    },
  });

export function usePrReviews(owner: string, repo: string, number: number) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    ...prReviewsQueryOptions(owner, repo, number),
    enabled: !!token && !!owner && !!repo && Number.isFinite(number),
  });
}

export function usePrReviewDecisions(
  owner: string,
  repo: string,
  numbers: number[],
): Map<number, AggregatedReviewDecision> {
  const token = useAuthStore((s) => s.token);
  const uniqueNumbers = Array.from(new Set(numbers)).filter(Number.isFinite);
  const results = useQueries({
    queries: uniqueNumbers.map((number) => ({
      ...prReviewsQueryOptions(owner, repo, number),
      enabled: !!token && !!owner && !!repo && Number.isFinite(number),
    })),
  });

  const decisions = new Map<number, AggregatedReviewDecision>();
  results.forEach((result, index) => {
    const number = uniqueNumbers[index];
    if (number === undefined || !result.data) return;
    decisions.set(number, aggregateReviews(result.data));
  });
  return decisions;
}

export const prTimelineQueryOptions = (owner: string, repo: string, number: number) =>
  queryOptions({
    queryKey: pullsKeys.timeline(owner, repo, number),
    staleTime: 15_000,
    queryFn: async (): Promise<TimelineEvent[]> => {
      const client = getGitHubClient();
      return fetchAllPages(
        (page) =>
          client.request("GET /repos/{owner}/{repo}/issues/{issue_number}/timeline", {
            owner,
            repo,
            issue_number: number,
            per_page: 100,
            page,
            headers: { accept: "application/vnd.github.mockingbird-preview+json" },
          }),
        (data) => {
          const raw = Array.isArray(data) ? data : [];
          const events: TimelineEvent[] = [];
          for (const item of raw) {
            const result = TimelineEventSchema.safeParse(item);
            if (result.success) events.push(result.data);
          }
          return events;
        },
      );
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
        user: me ? { login: me.login, avatar_url: me.avatar_url, html_url: undefined } : null,
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
      queryClient.setQueryData<IssueCommentOnPr[]>(key, (old) => [...(old ?? []), optimistic]);
      return { prev, tempId, key };
    },
    onError: (_err, _vars, ctx) => {
      // Roll back to previous state on error
      if (ctx?.prev) queryClient.setQueryData(ctx.key, ctx.prev);
    },
    onSuccess: async (created, _vars, ctx) => {
      if (ctx) {
        queryClient.setQueryData<IssueCommentOnPr[]>(ctx.key, (old) =>
          (old ?? []).map((c) => (c.id === ctx.tempId ? created : c)),
        );
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: pullsKeys.detail(owner, repo, number) }),
        queryClient.invalidateQueries({ queryKey: pullsKeys.timeline(owner, repo, number) }),
        queryClient.invalidateQueries({ queryKey: pullsKeys.lists(owner, repo) }),
      ]);
    },
  });
}

// ─── PR files (diff) ───────────────────────────────────────────────────────
//
// Full fetch of the PR's changed-files list with patches inline. GitHub
// paginates at 100 files/page; we walk every page so large PRs don't silently
// drop files from review, sidebar navigation, or counts.

const PrFilesResponseSchema = z.array(PrFileSchema);

export const prFilesQueryOptions = (owner: string, repo: string, number: number) =>
  queryOptions({
    queryKey: pullsKeys.files(owner, repo, number),
    staleTime: 30_000,
    queryFn: async (): Promise<PrFile[]> => {
      const client = getGitHubClient();
      return fetchAllPages(
        (page) =>
          client.request("GET /repos/{owner}/{repo}/pulls/{pull_number}/files", {
            owner,
            repo,
            pull_number: number,
            per_page: 100,
            page,
          }),
        (data) => PrFilesResponseSchema.parse(data),
      );
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
      return fetchAllPages(
        (page) =>
          client.request("GET /repos/{owner}/{repo}/pulls/{pull_number}/commits", {
            owner,
            repo,
            pull_number: number,
            per_page: 100,
            page,
          }),
        (data) => PrCommitsResponseSchema.parse(data),
      );
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
      owner: z.object({ login: z.string(), avatar_url: z.string() }).nullable().optional(),
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
      const [checkRuns, statusRes] = await Promise.all([
        fetchAllPages(
          (page) =>
            client.request("GET /repos/{owner}/{repo}/commits/{ref}/check-runs", {
              owner,
              repo,
              ref: sha,
              per_page: 100,
              page,
            }),
          (data) => CheckRunsResponseSchema.parse(data).check_runs,
        ),
        client.request("GET /repos/{owner}/{repo}/commits/{ref}/status", {
          owner,
          repo,
          ref: sha,
        }),
      ]);
      return {
        checkRuns,
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

// ─── Check rollup (list-row CI status) ─────────────────────────────────────
//
// The PR-list rows come from the Search API, which never carries a head
// SHA — so we can't reuse the REST checks endpoints (keyed on SHA) there.
// Instead we ask GraphQL for the rolled-up status of each PR's last commit
// (`statusCheckRollup`) plus its individual contexts — both modern CheckRuns
// (GitHub Actions / third-party) and legacy StatusContexts — so the row can
// show GitHub's green-check / red-X / amber signal *and* a hover-card listing
// every step. Batched across the visible list via `useQueries` so each PR
// caches independently and survives infinite scroll — mirrors
// `usePrReviewDecisions`.

export type CheckRollupState = "success" | "failure" | "pending";

/** Normalized per-check lifecycle, mapped to a `StatusPill` variant in views. */
export type CheckContextStatus =
  | "success"
  | "failure"
  | "pending"
  | "neutral"
  | "skipped"
  | "cancelled";

/** One row in the checks hover-card — a CheckRun or a legacy StatusContext. */
export type CheckRollupContext = {
  name: string;
  status: CheckContextStatus;
  description: string | null;
  url: string | null;
};

export type PrCheckRollup = {
  state: CheckRollupState;
  contexts: CheckRollupContext[];
};

type RawCheckRunNode = {
  __typename: "CheckRun";
  name?: string | null;
  status?: string | null;
  conclusion?: string | null;
  detailsUrl?: string | null;
};

type RawStatusContextNode = {
  __typename: "StatusContext";
  context?: string | null;
  state?: string | null;
  description?: string | null;
  targetUrl?: string | null;
};

type CheckRollupQueryResponse = {
  repository?: {
    pullRequest?: {
      commits?: {
        nodes?: Array<{
          commit?: {
            statusCheckRollup?: {
              state?: string | null;
              contexts?: { nodes?: Array<RawCheckRunNode | RawStatusContextNode> } | null;
            } | null;
          } | null;
        }>;
      } | null;
    } | null;
  } | null;
};

const PR_CHECK_ROLLUP_QUERY = `
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        commits(last: 1) {
          nodes {
            commit {
              statusCheckRollup {
                state
                contexts(first: 100) {
                  nodes {
                    __typename
                    ... on CheckRun {
                      name
                      status
                      conclusion
                      detailsUrl
                    }
                    ... on StatusContext {
                      context
                      state
                      description
                      targetUrl
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

// GraphQL rollup enum → our UI tri-state. Anything else (incl. no checks
// configured → null) returns null so the row shows no icon, matching GitHub.
function toCheckRollupState(state: string | null | undefined): CheckRollupState | null {
  switch (state) {
    case "SUCCESS":
      return "success";
    case "FAILURE":
    case "ERROR":
      return "failure";
    case "PENDING":
    case "EXPECTED":
      return "pending";
    default:
      return null;
  }
}

// A modern CheckRun: running until `COMPLETED`, then keyed off its conclusion.
function checkRunStatus(
  status: string | null | undefined,
  conclusion: string | null | undefined,
): CheckContextStatus {
  if (status !== "COMPLETED") return "pending";
  switch (conclusion) {
    case "SUCCESS":
      return "success";
    case "FAILURE":
    case "TIMED_OUT":
    case "STARTUP_FAILURE":
    case "ACTION_REQUIRED":
      return "failure";
    case "SKIPPED":
      return "skipped";
    case "CANCELLED":
    case "STALE":
      return "cancelled";
    default:
      return "neutral";
  }
}

// A legacy StatusContext (Travis-era providers): a flat state enum.
function statusContextStatus(state: string | null | undefined): CheckContextStatus {
  switch (state) {
    case "SUCCESS":
      return "success";
    case "FAILURE":
    case "ERROR":
      return "failure";
    case "PENDING":
    case "EXPECTED":
      return "pending";
    default:
      return "neutral";
  }
}

function toRollupContext(node: RawCheckRunNode | RawStatusContextNode): CheckRollupContext | null {
  if (node.__typename === "CheckRun") {
    return {
      name: node.name ?? "Check",
      status: checkRunStatus(node.status, node.conclusion),
      description: null,
      url: node.detailsUrl ?? null,
    };
  }
  if (node.__typename === "StatusContext") {
    return {
      name: node.context ?? "Status",
      status: statusContextStatus(node.state),
      description: node.description ?? null,
      url: node.targetUrl ?? null,
    };
  }
  return null;
}

export const prCheckRollupQueryOptions = (owner: string, repo: string, number: number) =>
  queryOptions({
    queryKey: pullsKeys.checkRollup(owner, repo, number),
    staleTime: 15_000,
    queryFn: async (): Promise<PrCheckRollup | null> => {
      const client = getGitHubClient();
      const res = (await client.graphql(PR_CHECK_ROLLUP_QUERY, {
        owner,
        repo,
        number,
      })) as CheckRollupQueryResponse;
      const rollup = res.repository?.pullRequest?.commits?.nodes?.[0]?.commit?.statusCheckRollup;
      const state = toCheckRollupState(rollup?.state);
      if (!state) return null;
      const contexts = (rollup?.contexts?.nodes ?? [])
        .map(toRollupContext)
        .filter((c): c is CheckRollupContext => c !== null);
      return { state, contexts };
    },
  });

export function usePrCheckRollups(
  owner: string,
  repo: string,
  numbers: number[],
): Map<number, PrCheckRollup> {
  const token = useAuthStore((s) => s.token);
  const uniqueNumbers = Array.from(new Set(numbers)).filter(Number.isFinite);
  const results = useQueries({
    queries: uniqueNumbers.map((number) => ({
      ...prCheckRollupQueryOptions(owner, repo, number),
      enabled: !!token && !!owner && !!repo && Number.isFinite(number),
      // Keep ticking while a PR's checks are still running; stop once terminal.
      refetchInterval: (q: { state: { data?: PrCheckRollup | null } }) =>
        q.state.data?.state === "pending" ? 15_000 : false,
    })),
  });

  const rollups = new Map<number, PrCheckRollup>();
  results.forEach((result, index) => {
    const number = uniqueNumbers[index];
    if (number === undefined || !result.data) return;
    rollups.set(number, result.data);
  });
  return rollups;
}

// ─── PR lifecycle actions ──────────────────────────────────────────────────
//
// Close / reopen / merge via REST; draft toggles via GraphQL (REST
// doesn't support flipping the draft flag post-creation). All writes
// optimistically patch the PR detail cache so the header flips state
// instantly, then invalidate on settle so the server's shape wins.

export type MergeMethod = "merge" | "squash" | "rebase";

export type ReviewDecision = "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | null;

export type RequiredCheckState = "passing" | "failing" | "pending" | "missing";

export type PrMergeStatusData = {
  reviewDecision: ReviewDecision;
  mergeStateStatus: string | null;
  autoMergeRequest: {
    enabledAt: string | null;
    mergeMethod: MergeMethod;
    enabledBy: { login: string } | null;
  } | null;
  viewerCanEnableAutoMerge: boolean;
  viewerCanDisableAutoMerge: boolean;
  viewerCanMergeAsAdmin: boolean;
  viewerCanDeleteHeadRef: boolean;
  viewerCanUpdateBranch: boolean;
  viewerCannotUpdateReasons: string[];
  headRefExists: boolean;
  headRefOid: string | null;
  baseRefOid: string | null;
  protection: {
    requiresApprovingReviews: boolean;
    requiredApprovingReviewCount: number;
    requiresCodeOwnerReviews: boolean;
    dismissesStaleReviews: boolean;
    requiresStatusChecks: boolean;
    requiresStrictStatusChecks: boolean;
    requiresConversationResolution: boolean;
    requiredStatusCheckContexts: string[];
  };
  reviewThreads: {
    totalCount: number;
    unresolvedCount: number;
  };
};

type PrMergeStatusQueryResponse = {
  repository?: {
    pullRequest?: {
      reviewDecision?: Exclude<ReviewDecision, null> | null;
      mergeStateStatus?: string | null;
      autoMergeRequest?: {
        enabledAt?: string | null;
        mergeMethod?: "MERGE" | "SQUASH" | "REBASE" | null;
        enabledBy?: { login?: string } | null;
      } | null;
      viewerCanEnableAutoMerge?: boolean;
      viewerCanDisableAutoMerge?: boolean;
      viewerCanMergeAsAdmin?: boolean;
      viewerCanDeleteHeadRef?: boolean;
      viewerCanUpdate?: boolean;
      viewerCannotUpdateReasons?: string[];
      headRef?: { id?: string } | null;
      headRefOid?: string | null;
      baseRefOid?: string | null;
      baseRef?: {
        branchProtectionRule?: {
          requiresApprovingReviews?: boolean;
          requiredApprovingReviewCount?: number;
          requiresCodeOwnerReviews?: boolean;
          dismissesStaleReviews?: boolean;
          requiresStatusChecks?: boolean;
          requiresStrictStatusChecks?: boolean;
          requiresConversationResolution?: boolean;
          requiredStatusCheckContexts?: string[];
        } | null;
      } | null;
      reviewThreads?: {
        totalCount?: number;
        pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
        nodes?: Array<{ isResolved?: boolean | null }>;
      };
    } | null;
  } | null;
};

const PR_MERGE_STATUS_QUERY = `
  query($owner: String!, $repo: String!, $number: Int!, $after: String) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        reviewDecision
        mergeStateStatus
        autoMergeRequest {
          enabledAt
          mergeMethod
          enabledBy { login }
        }
        viewerCanEnableAutoMerge
        viewerCanDisableAutoMerge
        viewerCanMergeAsAdmin
        viewerCanDeleteHeadRef
        viewerCanUpdate
        viewerCannotUpdateReasons
        headRef { id }
        headRefOid
        baseRefOid
        baseRef {
          branchProtectionRule {
            requiresApprovingReviews
            requiredApprovingReviewCount
            requiresCodeOwnerReviews
            dismissesStaleReviews
            requiresStatusChecks
            requiresStrictStatusChecks
            requiresConversationResolution
            requiredStatusCheckContexts
          }
        }
        reviewThreads(first: 100, after: $after) {
          totalCount
          pageInfo { hasNextPage endCursor }
          nodes { isResolved }
        }
      }
    }
  }
`;

function fromGraphqlMergeMethod(
  method: "MERGE" | "SQUASH" | "REBASE" | null | undefined,
): MergeMethod {
  if (method === "SQUASH") return "squash";
  if (method === "REBASE") return "rebase";
  return "merge";
}

function toGraphqlMergeMethod(method: MergeMethod): "MERGE" | "SQUASH" | "REBASE" {
  if (method === "squash") return "SQUASH";
  if (method === "rebase") return "REBASE";
  return "MERGE";
}

export const prMergeStatusQueryOptions = (owner: string, repo: string, number: number) =>
  queryOptions({
    queryKey: pullsKeys.mergeStatus(owner, repo, number),
    staleTime: 15_000,
    queryFn: async (): Promise<PrMergeStatusData> => {
      const client = getGitHubClient();
      let after: string | null | undefined;
      let firstPull: NonNullable<
        NonNullable<NonNullable<PrMergeStatusQueryResponse["repository"]>["pullRequest"]>
      > | null = null;
      let totalCount = 0;
      let unresolvedCount = 0;

      do {
        const res = (await client.graphql(PR_MERGE_STATUS_QUERY, {
          owner,
          repo,
          number,
          after,
        })) as PrMergeStatusQueryResponse;
        const pull = res.repository?.pullRequest;
        if (!pull) throw new Error("Pull request not found");
        firstPull ??= pull;
        const threads = pull.reviewThreads;
        totalCount = threads?.totalCount ?? totalCount;
        unresolvedCount += (threads?.nodes ?? []).filter((thread) => !thread.isResolved).length;
        after = threads?.pageInfo?.hasNextPage ? threads.pageInfo.endCursor : null;
      } while (after);

      if (!firstPull) throw new Error("Pull request not found");
      const rule = firstPull.baseRef?.branchProtectionRule;
      const autoMerge = firstPull.autoMergeRequest;

      return {
        reviewDecision: firstPull.reviewDecision ?? null,
        mergeStateStatus: firstPull.mergeStateStatus ?? null,
        autoMergeRequest: autoMerge
          ? {
              enabledAt: autoMerge.enabledAt ?? null,
              mergeMethod: fromGraphqlMergeMethod(autoMerge.mergeMethod),
              enabledBy: autoMerge.enabledBy?.login ? { login: autoMerge.enabledBy.login } : null,
            }
          : null,
        viewerCanEnableAutoMerge: firstPull.viewerCanEnableAutoMerge ?? false,
        viewerCanDisableAutoMerge: firstPull.viewerCanDisableAutoMerge ?? false,
        viewerCanMergeAsAdmin: firstPull.viewerCanMergeAsAdmin ?? false,
        viewerCanDeleteHeadRef: firstPull.viewerCanDeleteHeadRef ?? false,
        viewerCanUpdateBranch: firstPull.viewerCanUpdate ?? false,
        viewerCannotUpdateReasons: firstPull.viewerCannotUpdateReasons ?? [],
        headRefExists: !!firstPull.headRef,
        headRefOid: firstPull.headRefOid ?? null,
        baseRefOid: firstPull.baseRefOid ?? null,
        protection: {
          requiresApprovingReviews: rule?.requiresApprovingReviews ?? false,
          requiredApprovingReviewCount: rule?.requiredApprovingReviewCount ?? 0,
          requiresCodeOwnerReviews: rule?.requiresCodeOwnerReviews ?? false,
          dismissesStaleReviews: rule?.dismissesStaleReviews ?? false,
          requiresStatusChecks: rule?.requiresStatusChecks ?? false,
          requiresStrictStatusChecks: rule?.requiresStrictStatusChecks ?? false,
          requiresConversationResolution: rule?.requiresConversationResolution ?? false,
          requiredStatusCheckContexts: rule?.requiredStatusCheckContexts ?? [],
        },
        reviewThreads: { totalCount, unresolvedCount },
      };
    },
  });

export function usePrMergeStatus(owner: string, repo: string, number: number) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    ...prMergeStatusQueryOptions(owner, repo, number),
    enabled: !!token && !!owner && !!repo && Number.isFinite(number),
  });
}

export function useMergePr(owner: string, repo: string, number: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      method: MergeMethod;
      commitTitle?: string;
      commitMessage?: string;
      pullRequestId?: string;
      expectedHeadOid?: string;
      bypassRequirements?: boolean;
    }) => {
      const client = getGitHubClient();
      const res = await client.request("PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge", {
        owner,
        repo,
        pull_number: number,
        merge_method: vars.method,
        commit_title: vars.commitTitle,
        commit_message: vars.commitMessage,
        sha: vars.expectedHeadOid,
      });
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
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: pullsKeys.detail(owner, repo, number) }),
        queryClient.invalidateQueries({ queryKey: pullsKeys.mergeStatus(owner, repo, number) }),
        queryClient.invalidateQueries({ queryKey: pullsKeys.timeline(owner, repo, number) }),
        queryClient.invalidateQueries({ queryKey: pullsKeys.counts(owner, repo) }),
        queryClient.invalidateQueries({ queryKey: pullsKeys.lists(owner, repo) }),
      ]);
    },
  });
}

export function useSetPrAutoMerge(owner: string, repo: string, number: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      pullRequestId: string;
      enabled: boolean;
      method?: MergeMethod;
      commitTitle?: string;
      commitMessage?: string;
    }) => {
      const client = getGitHubClient();
      if (!vars.enabled) {
        return client.graphql(
          `mutation($id: ID!) {
            disablePullRequestAutoMerge(input: { pullRequestId: $id }) {
              pullRequest { id }
            }
          }`,
          { id: vars.pullRequestId },
        );
      }
      return client.graphql(
        `mutation($id: ID!, $method: PullRequestMergeMethod!, $headline: String, $body: String) {
          enablePullRequestAutoMerge(input: {
            pullRequestId: $id,
            mergeMethod: $method,
            commitHeadline: $headline,
            commitBody: $body
          }) {
            pullRequest { id }
          }
        }`,
        {
          id: vars.pullRequestId,
          method: toGraphqlMergeMethod(vars.method ?? "merge"),
          headline: vars.commitTitle,
          body: vars.commitMessage,
        },
      );
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: pullsKeys.detail(owner, repo, number) }),
        queryClient.invalidateQueries({ queryKey: pullsKeys.mergeStatus(owner, repo, number) }),
        queryClient.invalidateQueries({ queryKey: pullsKeys.timeline(owner, repo, number) }),
      ]);
    },
  });
}

export function useUpdatePrBranch(owner: string, repo: string, number: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ expectedHeadSha }: { expectedHeadSha?: string }) => {
      const client = getGitHubClient();
      const res = await client.request(
        "PUT /repos/{owner}/{repo}/pulls/{pull_number}/update-branch",
        {
          owner,
          repo,
          pull_number: number,
          expected_head_sha: expectedHeadSha,
        },
      );
      return res.data as { message?: string; url?: string };
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: pullsKeys.detail(owner, repo, number) }),
        queryClient.invalidateQueries({ queryKey: pullsKeys.mergeStatus(owner, repo, number) }),
        queryClient.invalidateQueries({ queryKey: pullsKeys.timeline(owner, repo, number) }),
        queryClient.invalidateQueries({ queryKey: pullsKeys.files(owner, repo, number) }),
        queryClient.invalidateQueries({ queryKey: pullsKeys.commits(owner, repo, number) }),
      ]);
    },
  });
}

function splitFullName(fullName: string | undefined): { owner: string; repo: string } | null {
  const [owner, repo] = fullName?.split("/") ?? [];
  return owner && repo ? { owner, repo } : null;
}

export function useDeletePrHeadRef(owner: string, repo: string, number: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pr }: { pr: PullRequest }) => {
      const headRepo = splitFullName(pr.head.repo?.full_name) ?? { owner, repo };
      const client = getGitHubClient();
      await client.request("DELETE /repos/{owner}/{repo}/git/refs/{ref}", {
        owner: headRepo.owner,
        repo: headRepo.repo,
        ref: `heads/${pr.head.ref}`,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: pullsKeys.detail(owner, repo, number) }),
        queryClient.invalidateQueries({ queryKey: pullsKeys.mergeStatus(owner, repo, number) }),
        queryClient.invalidateQueries({ queryKey: pullsKeys.timeline(owner, repo, number) }),
      ]);
    },
  });
}

export function useRestorePrHeadRef(owner: string, repo: string, number: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pullRequestId }: { pullRequestId: string }) => {
      const client = getGitHubClient();
      return client.graphql(
        `mutation($id: ID!) {
          restorePullRequestHeadRef(input: { pullRequestId: $id }) {
            pullRequest { id }
          }
        }`,
        { id: pullRequestId },
      );
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: pullsKeys.detail(owner, repo, number) }),
        queryClient.invalidateQueries({ queryKey: pullsKeys.mergeStatus(owner, repo, number) }),
        queryClient.invalidateQueries({ queryKey: pullsKeys.timeline(owner, repo, number) }),
      ]);
    },
  });
}

export function useTogglePrState(owner: string, repo: string, number: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ state }: { state: "open" | "closed" }) => {
      const client = getGitHubClient();
      const res = await client.request("PATCH /repos/{owner}/{repo}/pulls/{pull_number}", {
        owner,
        repo,
        pull_number: number,
        state,
      });
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
          closed_at: state === "closed" ? new Date().toISOString() : null,
        });
      }
      return { key, prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(ctx.key, ctx.prev);
    },
    onSuccess: async (updated) => {
      queryClient.setQueryData(pullsKeys.detail(owner, repo, number), updated);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: pullsKeys.timeline(owner, repo, number) }),
        queryClient.invalidateQueries({ queryKey: pullsKeys.counts(owner, repo) }),
        queryClient.invalidateQueries({ queryKey: pullsKeys.lists(owner, repo) }),
      ]);
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
      const res = await client.request("POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews", {
        owner,
        repo,
        pull_number: number,
        event,
        body: body?.trim() || undefined,
        comments: comments?.length ? comments : undefined,
      });
      return ReviewSchema.parse(res.data);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: pullsKeys.reviews(owner, repo, number) }),
        queryClient.invalidateQueries({ queryKey: pullsKeys.timeline(owner, repo, number) }),
        queryClient.invalidateQueries({ queryKey: pullsKeys.detail(owner, repo, number) }),
        queryClient.invalidateQueries({ queryKey: pullsKeys.reviewComments(owner, repo, number) }),
        queryClient.invalidateQueries({ queryKey: pullsKeys.lists(owner, repo) }),
      ]);
    },
  });
}

export function useSetPrDraft(owner: string, repo: string, number: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ draft, nodeId }: { draft: boolean; nodeId: string }) => {
      const client = getGitHubClient();
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
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: pullsKeys.detail(owner, repo, number) }),
        queryClient.invalidateQueries({ queryKey: pullsKeys.lists(owner, repo) }),
      ]);
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

export const prReviewCommentsQueryOptions = (owner: string, repo: string, number: number) =>
  queryOptions({
    queryKey: pullsKeys.reviewComments(owner, repo, number),
    staleTime: 15_000,
    queryFn: async (): Promise<ReviewComment[]> => {
      const client = getGitHubClient();
      return fetchAllPages(
        (page) =>
          client.request("GET /repos/{owner}/{repo}/pulls/{pull_number}/comments", {
            owner,
            repo,
            pull_number: number,
            per_page: 100,
            page,
          }),
        (data) => ReviewCommentsResponseSchema.parse(data),
      );
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
  me?: { login: string; avatar_url: string },
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ inReplyToId, body }: { inReplyToId: number; body: string }) => {
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
    onMutate: async ({ inReplyToId, body }) => {
      const key = pullsKeys.reviewComments(owner, repo, number);
      const prev = queryClient.getQueryData<ReviewComment[]>(key);
      const parent = prev?.find((c) => c.id === inReplyToId);
      const tempId = -Date.now();
      const nowIso = new Date().toISOString();
      const optimistic: ReviewComment = {
        id: tempId,
        node_id: `temp-${tempId}`,
        pull_request_review_id: null,
        url: "",
        html_url: "",
        user: me
          ? { login: me.login, avatar_url: me.avatar_url, html_url: undefined }
          : { login: "you", avatar_url: "", html_url: undefined },
        body,
        created_at: nowIso,
        updated_at: nowIso,
        path: parent?.path ?? "",
        commit_id: parent?.commit_id ?? "",
        in_reply_to_id: inReplyToId,
        diff_hunk: parent?.diff_hunk ?? "",
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
      queryClient.setQueryData<ReviewComment[]>(key, (old) => [...(old ?? []), optimistic]);
      await queryClient.cancelQueries({ queryKey: key });
      return { prev, tempId, key };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(ctx.key, ctx.prev);
    },
    onSuccess: (created, _vars, ctx) => {
      // Swap temp → real in place
      if (ctx) {
        queryClient.setQueryData<ReviewComment[]>(ctx.key, (old) =>
          (old ?? []).map((c) => (c.id === ctx.tempId ? created : c)),
        );
      }
    },
  });
}

// ─── Review comment reactions ─────────────────────────────────────────────

import {
  EMPTY_MY_REACTIONS,
  type MyReactionsMap,
  type ReactionContent,
  ReactionListSchema,
} from "@/app/features/issues/schemas";

export function useMyReviewCommentReactions(
  owner: string,
  repo: string,
  commentId: number,
  meId: number | undefined,
) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: [
      ...pullsKeys.all,
      "review-comment-reactions",
      owner,
      repo,
      commentId,
      meId ?? 0,
    ] as const,
    staleTime: 60_000,
    enabled: !!token && !!owner && !!repo && !!meId && commentId > 0,
    queryFn: async (): Promise<MyReactionsMap> => {
      const client = getGitHubClient();
      const list = await fetchAllPages(
        (page) =>
          client.request("GET /repos/{owner}/{repo}/pulls/comments/{comment_id}/reactions", {
            owner,
            repo,
            comment_id: commentId,
            per_page: 100,
            page,
          }),
        (data) => ReactionListSchema.parse(data),
      );
      const map: MyReactionsMap = new Map();
      for (const reaction of list) {
        if (reaction.user?.id === meId) map.set(reaction.content, reaction.id);
      }
      return map;
    },
  });
}

export function useToggleReviewCommentReaction(
  owner: string,
  repo: string,
  prNumber: number,
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
          "DELETE /repos/{owner}/{repo}/pulls/comments/{comment_id}/reactions/{reaction_id}",
          { owner, repo, comment_id: commentId, reaction_id: existingReactionId },
        );
        return { newReactionId: null as number | null, content, commentId };
      }
      const res = await client.request(
        "POST /repos/{owner}/{repo}/pulls/comments/{comment_id}/reactions",
        { owner, repo, comment_id: commentId, content },
      );
      return { newReactionId: (res.data as { id: number }).id, content, commentId };
    },
    onMutate: async ({ commentId, content, existingReactionId }) => {
      const key = pullsKeys.reviewComments(owner, repo, prNumber);
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<ReviewComment[]>(key);
      if (prev) {
        queryClient.setQueryData<ReviewComment[]>(
          key,
          prev.map((c) => {
            if (c.id !== commentId) return c;
            const delta = existingReactionId ? -1 : 1;
            return {
              ...c,
              reactions: {
                ...c.reactions,
                [content]: Math.max(0, (c.reactions[content] ?? 0) + delta),
              },
            };
          }),
        );
      }
      return { prev, key };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(ctx.key, ctx.prev);
    },
    onSuccess: ({ newReactionId, content, commentId }) => {
      const myKey = [
        ...pullsKeys.all,
        "review-comment-reactions",
        owner,
        repo,
        commentId,
        meId ?? 0,
      ];
      queryClient.setQueryData<MyReactionsMap>(myKey, (old) => {
        const next = new Map(old ?? []);
        if (newReactionId != null) next.set(content, newReactionId);
        else next.delete(content);
        return next;
      });
    },
  });
}

// ─── Thread resolution (GraphQL-only) ─────────────────────────────────────
//
// GitHub REST doesn't expose thread resolution state. We fetch it via
// GraphQL and return a Map<rootCommentDatabaseId, { threadNodeId, isResolved }>.

export type ThreadResolutionMap = Map<number, { threadNodeId: string; isResolved: boolean }>;

const THREAD_RESOLUTION_QUERY = `
  query($owner: String!, $repo: String!, $number: Int!, $after: String) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        reviewThreads(first: 100, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes {
            id
            isResolved
            comments(first: 1) {
              nodes { databaseId }
            }
          }
        }
      }
    }
  }
`;

type ThreadResolutionQueryResponse = {
  repository?: {
    pullRequest?: {
      reviewThreads?: {
        pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
        nodes?: Array<{
          id: string;
          isResolved: boolean;
          comments: { nodes: Array<{ databaseId: number }> };
        }>;
      };
    } | null;
  } | null;
};

export function useThreadResolution(owner: string, repo: string, number: number) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: pullsKeys.threadResolution(owner, repo, number),
    staleTime: 15_000,
    enabled: !!token && !!owner && !!repo && Number.isFinite(number),
    queryFn: async (): Promise<ThreadResolutionMap> => {
      const client = getGitHubClient();
      const map: ThreadResolutionMap = new Map();
      let after: string | null | undefined;

      do {
        const res = (await client.graphql(THREAD_RESOLUTION_QUERY, {
          owner,
          repo,
          number,
          after,
        })) as ThreadResolutionQueryResponse;
        const threads = res.repository?.pullRequest?.reviewThreads;
        for (const thread of threads?.nodes ?? []) {
          const rootId = thread.comments.nodes[0]?.databaseId;
          if (rootId != null) {
            map.set(rootId, { threadNodeId: thread.id, isResolved: thread.isResolved });
          }
        }
        after = threads?.pageInfo?.hasNextPage ? threads.pageInfo.endCursor : null;
      } while (after);

      return map;
    },
  });
}

export function useResolveThread(owner: string, repo: string, number: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ threadNodeId, resolve }: { threadNodeId: string; resolve: boolean }) => {
      const client = getGitHubClient();
      const mutation = resolve
        ? `mutation($id: ID!) { resolveReviewThread(input: { threadId: $id }) { thread { id isResolved } } }`
        : `mutation($id: ID!) { unresolveReviewThread(input: { threadId: $id }) { thread { id isResolved } } }`;
      return client.graphql(mutation, { id: threadNodeId });
    },
    onMutate: async ({ threadNodeId, resolve }) => {
      const key = pullsKeys.threadResolution(owner, repo, number);
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<ThreadResolutionMap>(key);
      if (prev) {
        const next = new Map(prev);
        for (const [rootId, entry] of next) {
          if (entry.threadNodeId === threadNodeId) {
            next.set(rootId, { ...entry, isResolved: resolve });
          }
        }
        queryClient.setQueryData<ThreadResolutionMap>(key, next);
      }
      return { key, prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(ctx.key, ctx.prev);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: pullsKeys.threadResolution(owner, repo, number),
      });
    },
  });
}

// ─── PR comment reactions ─────────────────────────────────────────────────
//
// PR conversation comments use the same /issues/comments/{id}/reactions API
// as issue comments. These hooks handle cache invalidation for PR-specific
// query keys.

function buildMyReactionsMap(
  reactions: Array<{ id: number; content: string; user: { id: number } | null }>,
  meId: number,
): MyReactionsMap {
  const m: MyReactionsMap = new Map();
  for (const r of reactions) {
    if (r.user?.id === meId) m.set(r.content as ReactionContent, r.id);
  }
  return m;
}

export function useMyPrCommentReactions(
  owner: string,
  repo: string,
  commentId: number,
  meId: number | undefined,
) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: [...pullsKeys.all, "comment-reactions", owner, repo, commentId, meId ?? 0] as const,
    enabled: !!token && !!owner && !!repo && commentId > 0 && !!meId,
    staleTime: 60_000,
    queryFn: async (): Promise<MyReactionsMap> => {
      const client = getGitHubClient();
      const reactions = await fetchAllPages(
        (page) =>
          client.request("GET /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions", {
            owner,
            repo,
            comment_id: commentId,
            per_page: 100,
            page,
            headers: { accept: "application/vnd.github+json" },
          }),
        (data) => ReactionListSchema.parse(data),
      );
      return buildMyReactionsMap(reactions, meId as number);
    },
  });
}

export function useTogglePrCommentReaction(
  owner: string,
  repo: string,
  prNumber: number,
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
      const commentsKey = pullsKeys.comments(owner, repo, prNumber);
      const myKey = [
        ...pullsKeys.all,
        "comment-reactions",
        owner,
        repo,
        commentId,
        meId ?? 0,
      ] as const;
      await queryClient.cancelQueries({ queryKey: commentsKey });
      await queryClient.cancelQueries({ queryKey: myKey });

      const prevList = queryClient.getQueryData<IssueCommentOnPr[]>(commentsKey);
      const prevMy = queryClient.getQueryData<MyReactionsMap>(myKey);
      const delta = existingReactionId ? -1 : 1;

      if (prevList) {
        queryClient.setQueryData<IssueCommentOnPr[]>(
          commentsKey,
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

      return { prevList, prevMy, commentsKey, myKey };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevList) queryClient.setQueryData(ctx.commentsKey, ctx.prevList);
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
      queryClient.invalidateQueries({ queryKey: pullsKeys.comments(owner, repo, prNumber) });
      queryClient.invalidateQueries({
        queryKey: [...pullsKeys.all, "comment-reactions", owner, repo, vars.commentId, meId ?? 0],
      });
    },
  });
}

// ─── Edit / delete: PR body, conversation comments, reviews, inline comments

export function useUpdatePr(owner: string, repo: string, number: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ body }: { body: string }) => {
      const client = getGitHubClient();
      const res = await client.request("PATCH /repos/{owner}/{repo}/pulls/{pull_number}", {
        owner,
        repo,
        pull_number: number,
        body,
      });
      return PullRequestSchema.parse(res.data);
    },
    onMutate: async ({ body }) => {
      const key = pullsKeys.detail(owner, repo, number);
      const prev = queryClient.getQueryData<PullRequest>(key);
      if (prev) {
        queryClient.setQueryData<PullRequest>(key, {
          ...prev,
          body,
          updated_at: new Date().toISOString(),
        });
      }
      await queryClient.cancelQueries({ queryKey: key });
      return { prev, key };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(ctx.key, ctx.prev);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(pullsKeys.detail(owner, repo, number), updated);
    },
  });
}

export function useUpdatePrComment(owner: string, repo: string, number: number) {
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
      return IssueCommentOnPrSchema.parse(res.data);
    },
    onMutate: async ({ commentId, body }) => {
      const key = pullsKeys.comments(owner, repo, number);
      const prev = queryClient.getQueryData<IssueCommentOnPr[]>(key);
      const nowIso = new Date().toISOString();
      queryClient.setQueryData<IssueCommentOnPr[]>(key, (old) =>
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
        queryClient.setQueryData<IssueCommentOnPr[]>(ctx.key, (old) =>
          (old ?? []).map((c) => (c.id === updated.id ? updated : c)),
        );
      }
    },
  });
}

export function useDeletePrComment(owner: string, repo: string, number: number) {
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
      const key = pullsKeys.comments(owner, repo, number);
      const prev = queryClient.getQueryData<IssueCommentOnPr[]>(key);
      queryClient.setQueryData<IssueCommentOnPr[]>(key, (old) =>
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

export function useUpdateReview(owner: string, repo: string, number: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ reviewId, body }: { reviewId: number; body: string }) => {
      const client = getGitHubClient();
      const res = await client.request(
        "PUT /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}",
        { owner, repo, pull_number: number, review_id: reviewId, body },
      );
      return ReviewSchema.parse(res.data);
    },
    onMutate: async ({ reviewId, body }) => {
      const key = pullsKeys.reviews(owner, repo, number);
      const prev = queryClient.getQueryData<Review[]>(key);
      queryClient.setQueryData<Review[]>(key, (old) =>
        (old ?? []).map((r) => (r.id === reviewId ? { ...r, body } : r)),
      );
      await queryClient.cancelQueries({ queryKey: key });
      return { prev, key };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(ctx.key, ctx.prev);
    },
    onSuccess: (updated, _vars, ctx) => {
      if (ctx) {
        queryClient.setQueryData<Review[]>(ctx.key, (old) =>
          (old ?? []).map((r) => (r.id === updated.id ? updated : r)),
        );
      }
    },
  });
}

export function useUpdateReviewComment(owner: string, repo: string, number: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ commentId, body }: { commentId: number; body: string }) => {
      const client = getGitHubClient();
      const res = await client.request("PATCH /repos/{owner}/{repo}/pulls/comments/{comment_id}", {
        owner,
        repo,
        comment_id: commentId,
        body,
      });
      return ReviewCommentSchema.parse(res.data);
    },
    onMutate: async ({ commentId, body }) => {
      const key = pullsKeys.reviewComments(owner, repo, number);
      const prev = queryClient.getQueryData<ReviewComment[]>(key);
      const nowIso = new Date().toISOString();
      queryClient.setQueryData<ReviewComment[]>(key, (old) =>
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
        queryClient.setQueryData<ReviewComment[]>(ctx.key, (old) =>
          (old ?? []).map((c) => (c.id === updated.id ? updated : c)),
        );
      }
    },
  });
}

export function useDeleteReviewComment(owner: string, repo: string, number: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ commentId }: { commentId: number }) => {
      const client = getGitHubClient();
      await client.request("DELETE /repos/{owner}/{repo}/pulls/comments/{comment_id}", {
        owner,
        repo,
        comment_id: commentId,
      });
      return commentId;
    },
    onMutate: async ({ commentId }) => {
      const key = pullsKeys.reviewComments(owner, repo, number);
      const prev = queryClient.getQueryData<ReviewComment[]>(key);
      queryClient.setQueryData<ReviewComment[]>(key, (old) =>
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

// ─── Branch refs (list-row stacking) ──────────────────────────────────────
//
// The Search API doesn't return head/base branch names. We fetch them per-PR
// via a tiny GraphQL query so `buildPrTree` can detect stacked PRs (where
// one PR's base branch matches another PR's head branch). Batched across the
// visible list via `useQueries` — same pattern as `usePrCheckRollups`.

export type PrBranchRefs = {
  headRefName: string;
  baseRefName: string;
};

type BranchRefsQueryResponse = {
  repository?: {
    pullRequest?: {
      headRefName?: string | null;
      baseRefName?: string | null;
    } | null;
  } | null;
};

const PR_BRANCH_REFS_QUERY = `
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        headRefName
        baseRefName
      }
    }
  }
`;

export const prBranchRefsQueryOptions = (owner: string, repo: string, number: number) =>
  queryOptions({
    queryKey: pullsKeys.branchRefs(owner, repo, number),
    staleTime: 60_000,
    queryFn: async (): Promise<PrBranchRefs | null> => {
      const client = getGitHubClient();
      const res = (await client.graphql(PR_BRANCH_REFS_QUERY, {
        owner,
        repo,
        number,
      })) as BranchRefsQueryResponse;
      const pr = res.repository?.pullRequest;
      if (!pr?.headRefName || !pr?.baseRefName) return null;
      return { headRefName: pr.headRefName, baseRefName: pr.baseRefName };
    },
  });

export function usePrBranchRefs(
  owner: string,
  repo: string,
  numbers: number[],
): Map<number, PrBranchRefs> {
  const token = useAuthStore((s) => s.token);
  const uniqueNumbers = Array.from(new Set(numbers)).filter(Number.isFinite);
  const results = useQueries({
    queries: uniqueNumbers.map((number) => ({
      ...prBranchRefsQueryOptions(owner, repo, number),
      enabled: !!token && !!owner && !!repo && Number.isFinite(number),
    })),
  });

  const refs = new Map<number, PrBranchRefs>();
  results.forEach((result, index) => {
    const number = uniqueNumbers[index];
    if (number === undefined || !result.data) return;
    refs.set(number, result.data);
  });
  return refs;
}
