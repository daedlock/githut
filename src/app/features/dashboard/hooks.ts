import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { PrListItemSchema } from "@/app/features/pulls/hooks";
import { useLiveInterval } from "@/app/lib/freshness";
import { getGitHubClient } from "@/app/lib/github/client";
import { useAuthStore } from "@/app/stores/auth";

// ─── Schema ────────────────────────────────────────────────────────────────
//
// `/search/issues` returns a cross-repo list. PrListItemSchema (defined in
// the pulls feature) covers everything we need from a row, but it doesn't
// carry the `repository_url` field — single-repo pages don't need it. The
// dashboard does, so we extend.

const DashboardItemSchema = PrListItemSchema.extend({
  repository_url: z.string(),
});

const SearchResponseSchema = z.object({
  total_count: z.number(),
  incomplete_results: z.boolean(),
  items: z.array(DashboardItemSchema),
});

type RawDashboardItem = z.infer<typeof DashboardItemSchema>;

// ─── Why-it's-here ─────────────────────────────────────────────────────────

export type DashboardReason = "review_requested" | "assigned" | "mentioned";

export type DashboardItem = RawDashboardItem & {
  ownerRepo: { owner: string; repo: string };
  /** Highest-priority reason the item appeared. */
  reason: DashboardReason;
  /** True when the search row carries a non-null `pull_request` block. */
  isPr: boolean;
};

const REPO_URL_RE = /\/repos\/([^/]+)\/([^/]+)\/?$/;
function parseOwnerRepo(url: string): { owner: string; repo: string } | null {
  const m = REPO_URL_RE.exec(url);
  return m ? { owner: m[1]!, repo: m[2]! } : null;
}

// ─── One search query → typed list ─────────────────────────────────────────

const PER_PAGE = 30;

async function fetchSearch(
  q: string,
  reason: DashboardReason | null,
  sort: "created" | "updated",
  order: "asc" | "desc",
): Promise<DashboardItem[]> {
  const client = getGitHubClient();
  const res = await client.request("GET /search/issues", {
    q,
    sort,
    order,
    per_page: PER_PAGE,
  });
  const parsed = SearchResponseSchema.parse(res.data);
  const items: DashboardItem[] = [];
  for (const raw of parsed.items) {
    const ownerRepo = parseOwnerRepo(raw.repository_url);
    if (!ownerRepo) continue;
    items.push({
      ...raw,
      ownerRepo,
      reason: reason ?? "assigned",
      isPr: !!raw.pull_request,
    });
  }
  return items;
}

// ─── Recency horizon ───────────────────────────────────────────────────────
//
// Review requests have no horizon: one doesn't go stale until you respond.
// Your own open PRs are limited to the last 90 days, so abandoned drafts from
// years ago don't bury the work that's live.

const DAY_MS = 86_400_000;

function dateAgoIso(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString().slice(0, 10);
}

// ─── Your work: review requests, oldest waiting first ──────────────────────

// Search allows 30 requests a minute and these lists also back the sidebar's
// Your work: they refresh about once a minute even in the focused tab.
const SEARCH_FLOOR = 60_000;

export function useReviewRequestedPrs() {
  const token = useAuthStore((s) => s.token);
  const live = useLiveInterval("search");
  return useQuery({
    queryKey: ["dashboard", "your-work", "review-requested"] as const,
    enabled: !!token,
    staleTime: 30_000,
    refetchInterval: () => live("changing", SEARCH_FLOOR),
    queryFn: () =>
      fetchSearch(
        "is:open is:pr review-requested:@me archived:false",
        "review_requested",
        "created",
        "asc",
      ),
  });
}

// ─── Your work: your open PRs, recently updated ────────────────────────────

export function useMyOpenPrs() {
  const token = useAuthStore((s) => s.token);
  const live = useLiveInterval("search");
  // The horizon changes once a day; keying on it drops yesterday's results.
  const since = dateAgoIso(90);
  return useQuery({
    queryKey: ["dashboard", "my-open-prs", since] as const,
    enabled: !!token,
    staleTime: 30_000,
    refetchInterval: () => live("changing", SEARCH_FLOOR),
    queryFn: () =>
      fetchSearch(
        `is:open is:pr author:@me archived:false updated:>=${since}`,
        null,
        "updated",
        "desc",
      ),
  });
}
