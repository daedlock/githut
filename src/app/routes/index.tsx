import { createFileRoute, redirect } from "@tanstack/react-router";
import { CheckCircle2, Inbox } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/app/components/shell/AppShell";
import { UnifiedNav } from "@/app/components/shell/UnifiedNav";
import { Container } from "@/app/components/ui/Container";
import { Skeleton } from "@/app/components/ui/skeleton";
import { DashRow } from "@/app/features/dashboard/components/DashRow";
import { DashboardSidebar } from "@/app/features/dashboard/components/DashboardSidebar";
import {
  useMyOpenPrs,
  useYourTurn,
  type DashboardItem,
} from "@/app/features/dashboard/hooks";
import {
  applyFilters,
  buildCounts,
  buildPool,
  buildRepoCounts,
  pickDate,
  sortEntries,
  type DashboardCategory,
  type DashEntry,
} from "@/app/features/dashboard/lib/filter";
import { ageBucket, type AgeBucket } from "@/app/features/dashboard/lib/buckets";
import { reposQueryOptions } from "@/app/hooks/useRepos";
import { useAuthStore } from "@/app/stores/auth";

const CATEGORY_TITLES: Record<DashboardCategory, string> = {
  all: "All",
  review: "Review requested",
  assigned: "Assigned",
  mentioned: "Mentioned",
  "my-prs": "Your open PRs",
};

const CATEGORY_EMPTY_COPY: Record<DashboardCategory, { headline: string; sub: string }> = {
  all: {
    headline: "All clear.",
    sub: "Nothing waiting on you, no open work to track.",
  },
  review: {
    headline: "No reviews waiting on you.",
    sub: "When someone requests your review, it'll show up here.",
  },
  assigned: {
    headline: "Nothing assigned to you.",
    sub: "Stale assignments are hidden — items must have moved in the last 60 days.",
  },
  mentioned: {
    headline: "No fresh mentions.",
    sub: "Only mentions with activity in the last 30 days appear here.",
  },
  "my-prs": {
    headline: "No open PRs from you.",
    sub: "Authored PRs with activity in the last 90 days will show up here.",
  },
};

const BUCKET_ORDER: AgeBucket[] = ["today", "week", "older"];
const BUCKET_LABEL: Record<AgeBucket, string> = {
  today: "Today",
  week: "This week",
  older: "Older",
};

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (!useAuthStore.getState().token) throw redirect({ to: "/login" });
  },
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(reposQueryOptions());
  },
  component: IndexPage,
});

function IndexPage() {
  const [category, setCategory] = useState<DashboardCategory>("all");
  const [repo, setRepo] = useState<string | null>(null);

  const yourTurn = useYourTurn();
  const myPrs = useMyOpenPrs();

  const pool = useMemo(
    () => buildPool(yourTurn.items, myPrs.data ?? []),
    [yourTurn.items, myPrs.data],
  );
  const counts = useMemo(
    () => buildCounts(yourTurn.items, myPrs.data, yourTurn.isPending, myPrs.isPending),
    [yourTurn.items, myPrs.data, yourTurn.isPending, myPrs.isPending],
  );
  const repoCounts = useMemo(() => buildRepoCounts(pool), [pool]);
  const filtered = useMemo(
    () => sortEntries(applyFilters(pool, category, repo)),
    [pool, category, repo],
  );

  const groups = useMemo(() => groupByBucket(filtered), [filtered]);

  const isPending = yourTurn.isPending || myPrs.isPending;
  const isError = yourTurn.isError || myPrs.isError;

  return (
    <AppShell header={<UnifiedNav />}>
      <Container size="xl" className="py-4">
        <div className="flex items-start gap-5">
          <DashboardSidebar
            category={category}
            onCategoryChange={(next) => {
              setCategory(next);
            }}
            repo={repo}
            onRepoChange={setRepo}
            counts={counts}
            repoCounts={repoCounts}
          />
          {/*
            Main column is the raised content surface: bg-muted, rounded-lg,
            no border. This is the "borderless surface card" pattern from
            the PR/issue detail views — sidebar (page surface) sits beside
            it (raised surface), separation via surface contrast, not chrome.
          */}
          <main className="min-w-0 flex-1 rounded-lg bg-muted px-4 py-5 sm:px-5">
            <MainHeader
              title={CATEGORY_TITLES[category]}
              shown={filtered.length}
              total={counts[category] ?? null}
              repo={repo}
              onClearRepo={() => setRepo(null)}
            />

            {isPending ? (
              <RowsSkeleton />
            ) : isError ? (
              <ErrorState />
            ) : groups.length === 0 ? (
              <EmptyState category={category} repo={repo} />
            ) : (
              <div className="flex flex-col gap-6">
                {groups.map((g) => (
                  <BucketGroup
                    key={g.bucket}
                    label={BUCKET_LABEL[g.bucket]}
                    count={g.entries.length}
                  >
                    {g.entries.map((entry) => (
                      <DashRow
                        key={`${entry.kind}-${entry.item.id}`}
                        item={entry.item}
                        date={pickDate(entry)}
                        showReason={entry.kind === "turn"}
                      />
                    ))}
                  </BucketGroup>
                ))}
              </div>
            )}
          </main>
        </div>
      </Container>
    </AppShell>
  );
}

// ─── Group by bucket (post-filter) ─────────────────────────────────────────
//
// Same age-bucket logic as the helper, but operates on DashEntry (the
// post-filter pool element) rather than DashboardItem so we can pass entries
// through to DashRow with their `kind` tag intact for the date-axis pick.

type BucketGroupData = { bucket: AgeBucket; entries: DashEntry[] };

function groupByBucket(entries: DashEntry[]): BucketGroupData[] {
  const map = new Map<AgeBucket, DashEntry[]>();
  for (const entry of entries) {
    const b = ageBucket(pickDate(entry));
    const list = map.get(b) ?? [];
    list.push(entry);
    map.set(b, list);
  }
  const out: BucketGroupData[] = [];
  for (const bucket of BUCKET_ORDER) {
    const list = map.get(bucket);
    if (list && list.length > 0) out.push({ bucket, entries: list });
  }
  return out;
}

// ─── Layout pieces ─────────────────────────────────────────────────────────

function MainHeader({
  title,
  shown,
  total,
  repo,
  onClearRepo,
}: {
  title: string;
  shown: number;
  total: number | null;
  repo: string | null;
  onClearRepo: () => void;
}) {
  return (
    <header className="mb-5 flex items-baseline gap-3">
      <h1 className="text-heading font-[475] tracking-tight text-foreground">{title}</h1>
      {total !== null ? (
        <span className="font-mono text-caption tabular-nums uppercase tracking-widest text-muted-foreground">
          {repo ? `${shown} in ${repo}` : `${total}`}
        </span>
      ) : null}
      {repo ? (
        <button
          type="button"
          onClick={onClearRepo}
          className="ml-auto rounded-md px-2 py-1 text-caption text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground"
        >
          Clear repo filter
        </button>
      ) : null}
    </header>
  );
}

function BucketGroup({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-1 flex items-baseline gap-2 px-3">
        <span className="font-mono text-micro uppercase tracking-widest text-(--color-fg-faint)">
          {label}
        </span>
        <span className="font-mono text-micro tabular-nums text-(--color-fg-faint)">
          {count}
        </span>
      </div>
      <div className="flex flex-col">{children}</div>
    </section>
  );
}

function RowsSkeleton() {
  const widths = [76, 58, 84, 50, 70, 64, 78];
  return (
    <div className="skeleton-fade flex flex-col">
      {widths.map((w) => (
        <div key={w} className="flex items-center gap-3 px-3 py-2">
          <Skeleton className="size-1.5 shrink-0 rounded-full" />
          <Skeleton className="size-3.5 shrink-0 rounded-full" />
          <Skeleton className="hidden h-3 sm:block" style={{ width: `${w / 4 + 6}%` }} />
          <Skeleton className="h-3.5 flex-1" style={{ maxWidth: `${w}%` }} />
          <Skeleton className="h-3 w-8" />
        </div>
      ))}
    </div>
  );
}

function ErrorState() {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
      <span className="font-mono text-ui text-(--color-danger)">
        Couldn't load your dashboard.
      </span>
      <span className="text-caption text-muted-foreground">
        GitHub may be slow or your token may have expired.
      </span>
    </div>
  );
}

function EmptyState({
  category,
  repo,
}: {
  category: DashboardCategory;
  repo: string | null;
}) {
  const copy = CATEGORY_EMPTY_COPY[category];
  const isAllClear = category === "all" || category === "review";
  const Icon = isAllClear ? CheckCircle2 : Inbox;
  const tone = isAllClear ? "text-(--color-success)" : "text-muted-foreground";

  return (
    <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
      <Icon className={`size-6 ${tone}`} />
      <span className="text-body font-[475] text-foreground">{copy.headline}</span>
      <span className="max-w-md text-caption text-muted-foreground">
        {repo ? `No items in ${repo} for this filter.` : copy.sub}
      </span>
    </div>
  );
}

export type { DashboardItem };
