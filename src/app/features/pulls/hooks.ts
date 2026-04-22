import {
  infiniteQueryOptions,
  queryOptions,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";
import { z } from "zod";
import { getGitHubClient } from "@/app/lib/github/client";
import { useAuthStore } from "@/app/stores/auth";
import { PullRequestSchema, type PullRequest } from "@/app/features/pulls/schemas";
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
