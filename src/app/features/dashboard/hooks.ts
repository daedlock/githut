import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { PrListItemSchema } from "@/app/features/pulls/hooks";
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

// review-requested ranks above assigned ranks above mentioned: when a single
// item matches more than one query, the most actionable reason wins so the
// row reads "REVIEW" rather than a softer label.
const REASON_PRIORITY: Record<DashboardReason, number> = {
  review_requested: 0,
  assigned: 1,
  mentioned: 2,
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

// ─── Recency horizons ──────────────────────────────────────────────────────
//
// Stale items are the single biggest noise source in GitHub notifications.
// We push the recency filter to the query so we never even paginate over
// items the user hasn't touched in months. Horizons are tuned per reason:
//
//   review_requested → no filter. A review request doesn't go stale until
//                      you respond; surfacing a 90-day-old request is the
//                      right amount of guilt.
//   assigned        → 60 days. Long enough to show real ownership; short
//                      enough to drop dead-issue assignments from years ago.
//   mentioned       → 30 days. Mentions decay fastest — a stale mention is
//                      almost never actionable.
//   author (my PRs) → no filter. Open work stays available in the sidebar.

const DAY_MS = 86_400_000;

function dateAgoIso(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString().slice(0, 10);
}

// ─── "Your turn" — three queries merged + ranked ───────────────────────────
//
// Three filter buckets that GitHub treats as separate ("Review requested",
// "Assigned", "Mentioned") get fetched in parallel and merged into one
// latency-sorted list. Items appearing in multiple buckets dedupe by id and
// keep the highest-priority reason. We sort by `created_at` ascending so the
// oldest-waiting items rise to the top — the dashboard's job is to surface
// what's been ignored, not what's freshest.

export type YourTurnResult = {
  items: DashboardItem[];
  isPending: boolean;
  isError: boolean;
};

export function useReviewRequestedPrs() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ["dashboard", "your-turn", "review-requested"] as const,
    enabled: !!token,
    staleTime: 30_000,
    queryFn: () =>
      fetchSearch(
        "is:open is:pr review-requested:@me archived:false",
        "review_requested",
        "created",
        "asc",
      ),
  });
}

export function useYourTurn(): YourTurnResult {
  const token = useAuthStore((s) => s.token);
  const enabled = !!token;

  // The horizon date changes once a day; cache key includes the day so we
  // don't hold yesterday's results past midnight.
  const assignedSince = dateAgoIso(60);
  const mentionedSince = dateAgoIso(30);

  const reviewRequested = useReviewRequestedPrs();

  const assigned = useQuery({
    queryKey: ["dashboard", "your-turn", "assigned", assignedSince] as const,
    enabled,
    staleTime: 30_000,
    queryFn: () =>
      fetchSearch(
        `is:open assignee:@me archived:false updated:>=${assignedSince}`,
        "assigned",
        "updated",
        "desc",
      ),
  });

  const mentioned = useQuery({
    queryKey: ["dashboard", "your-turn", "mentioned", mentionedSince] as const,
    enabled,
    staleTime: 30_000,
    queryFn: () =>
      fetchSearch(
        `is:open mentions:@me archived:false updated:>=${mentionedSince}`,
        "mentioned",
        "updated",
        "desc",
      ),
  });

  const buckets = [reviewRequested.data, assigned.data, mentioned.data];
  const seen = new Map<number, DashboardItem>();
  for (const list of buckets) {
    if (!list) continue;
    for (const item of list) {
      const existing = seen.get(item.id);
      if (!existing || REASON_PRIORITY[item.reason] < REASON_PRIORITY[existing.reason]) {
        seen.set(item.id, item);
      }
    }
  }
  const items = [...seen.values()].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  return {
    items,
    isPending: reviewRequested.isPending || assigned.isPending || mentioned.isPending,
    isError: reviewRequested.isError || assigned.isError || mentioned.isError,
  };
}

// ─── "Your open PRs" — single search ───────────────────────────────────────

export function useMyOpenPrs() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ["dashboard", "my-open-prs"] as const,
    enabled: !!token,
    staleTime: 30_000,
    queryFn: () => fetchSearch("is:open is:pr author:@me archived:false", null, "updated", "desc"),
  });
}
