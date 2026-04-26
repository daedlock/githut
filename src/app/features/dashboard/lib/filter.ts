import type { DashboardItem } from "@/app/features/dashboard/hooks";

export type RepoCount = { ownerRepo: string; count: number };

// ─── Categories ────────────────────────────────────────────────────────────
//
// One filter axis the sidebar exposes. "All" is the union of "Awaiting you"
// (review_requested + assigned + mentioned) and "my-prs". Selecting a single
// category narrows the main list; the repo axis is independent and applies
// on top of whatever category is active.

export type DashboardCategory = "all" | "review" | "assigned" | "mentioned" | "my-prs";

const REASON_TO_CATEGORY: Record<DashboardItem["reason"], DashboardCategory> = {
  review_requested: "review",
  assigned: "assigned",
  mentioned: "mentioned",
};

// ─── Pool ──────────────────────────────────────────────────────────────────
//
// One merged in-memory pool keyed by item id. Each item carries a `kind`
// tag that records which dataset it came from ("turn" = your-turn, "mine"
// = my-open-prs). When a single PR appears in both pools (e.g. you authored
// a PR and someone reviewed it back to you) we keep both copies because
// their date axes differ — your-turn sorts on created_at, my-prs on
// updated_at — so they belong in different sections.

export type DashKind = "turn" | "mine";

export type DashEntry = {
  item: DashboardItem;
  kind: DashKind;
};

export function buildPool(
  yourTurn: readonly DashboardItem[],
  myPrs: readonly DashboardItem[],
): DashEntry[] {
  const pool: DashEntry[] = [];
  for (const item of yourTurn) pool.push({ item, kind: "turn" });
  for (const item of myPrs) pool.push({ item, kind: "mine" });
  return pool;
}

// ─── Counts per category ───────────────────────────────────────────────────
//
// Counts power the sidebar badges. They reflect the *unfiltered* totals so
// users can see the full picture even when narrowing to a single category.
// `null` means the underlying query is still loading; the sidebar suppresses
// the badge in that state rather than flashing a stale 0.

export type CountState = {
  all: number | null;
  review: number | null;
  assigned: number | null;
  mentioned: number | null;
  "my-prs": number | null;
};

export function buildCounts(
  yourTurn: readonly DashboardItem[] | undefined,
  myPrs: readonly DashboardItem[] | undefined,
  yourTurnPending: boolean,
  myPrsPending: boolean,
): CountState {
  const yt = yourTurn ?? [];
  const mp = myPrs ?? [];

  let review = 0;
  let assigned = 0;
  let mentioned = 0;
  for (const item of yt) {
    const cat = REASON_TO_CATEGORY[item.reason];
    if (cat === "review") review++;
    else if (cat === "assigned") assigned++;
    else if (cat === "mentioned") mentioned++;
  }

  return {
    all: yourTurnPending || myPrsPending ? null : yt.length + mp.length,
    review: yourTurnPending ? null : review,
    assigned: yourTurnPending ? null : assigned,
    mentioned: yourTurnPending ? null : mentioned,
    "my-prs": myPrsPending ? null : mp.length,
  };
}

// ─── Per-repo counts ───────────────────────────────────────────────────────
//
// The unique set of repos appearing across the merged pool, with how many
// items each contributes. Sorted by descending count so the loudest repos
// rise; ties broken alphabetically. A repo with a single item still gets a
// row — the dashboard purposefully exposes them so users see the long tail
// they'd otherwise miss.

export function buildRepoCounts(pool: DashEntry[]): RepoCount[] {
  const counts = new Map<string, number>();
  for (const { item } of pool) {
    const key = `${item.ownerRepo.owner}/${item.ownerRepo.repo}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([ownerRepo, count]) => ({ ownerRepo, count }))
    .sort((a, b) => (b.count - a.count) || a.ownerRepo.localeCompare(b.ownerRepo));
}

// ─── Apply filters ─────────────────────────────────────────────────────────
//
// Returns the filtered subset that should render in the main column. Order:
// category narrowing first (cheap, drops ~80% of the pool in most cases),
// then repo narrowing on what remains. Sorting and bucketing are the
// caller's responsibility — different categories want different date axes.

export function applyFilters(
  pool: DashEntry[],
  category: DashboardCategory,
  repo: string | null,
): DashEntry[] {
  const out: DashEntry[] = [];
  for (const entry of pool) {
    if (!matchesCategory(entry, category)) continue;
    if (repo !== null) {
      const key = `${entry.item.ownerRepo.owner}/${entry.item.ownerRepo.repo}`;
      if (key !== repo) continue;
    }
    out.push(entry);
  }
  return out;
}

function matchesCategory(entry: DashEntry, category: DashboardCategory): boolean {
  switch (category) {
    case "all":
      return true;
    case "my-prs":
      return entry.kind === "mine";
    case "review":
      return entry.kind === "turn" && entry.item.reason === "review_requested";
    case "assigned":
      return entry.kind === "turn" && entry.item.reason === "assigned";
    case "mentioned":
      return entry.kind === "turn" && entry.item.reason === "mentioned";
  }
}

// ─── Date pick + sort ──────────────────────────────────────────────────────
//
// "Your turn" entries surface oldest-first by created_at — latency is the
// signal. "Your PR" entries surface most-recently-updated first because the
// user wants to see their own activity stream. The mixed "All" view uses
// each entry's natural axis.

export function pickDate(entry: DashEntry): string {
  return entry.kind === "turn" ? entry.item.created_at : entry.item.updated_at;
}

export function sortEntries(entries: DashEntry[]): DashEntry[] {
  return [...entries].sort((a, b) => {
    // Cross-kind: "turn" entries (latency) take precedence over "mine"
    // (recency). Within each kind, the kind's natural sort applies.
    if (a.kind !== b.kind) return a.kind === "turn" ? -1 : 1;
    if (a.kind === "turn") {
      return new Date(a.item.created_at).getTime() - new Date(b.item.created_at).getTime();
    }
    return new Date(b.item.updated_at).getTime() - new Date(a.item.updated_at).getTime();
  });
}
