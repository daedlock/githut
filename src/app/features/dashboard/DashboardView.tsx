import { CheckCircle2, Inbox } from "lucide-react";
import { useMemo, useState } from "react";
import { LiveUpdates } from "@/app/components/LiveUpdates";
import { Avatar } from "@/app/components/ui/avatar";
import { Container } from "@/app/components/ui/Container";
import { Skeleton, SkeletonGroup } from "@/app/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/app/components/ui/toggle-group";
import { DashboardSidebar } from "@/app/features/dashboard/components/DashboardSidebar";
import { DashRow } from "@/app/features/dashboard/components/DashRow";
import { type DashboardItem, useMyOpenPrs, useYourTurn } from "@/app/features/dashboard/hooks";
import { type AgeBucket, ageBucket } from "@/app/features/dashboard/lib/buckets";
import {
  applyFilters,
  buildCounts,
  buildPool,
  buildRepoCounts,
  type DashboardCategory,
  type DashEntry,
  pickDate,
  sortEntries,
} from "@/app/features/dashboard/lib/filter";
import { useListNavigation } from "@/app/hooks/useListNavigation";
import { holdListOrder, useStableList } from "@/app/hooks/useStableList";
import { cn } from "@/app/lib/cn";

const CATEGORY_TITLES: Record<DashboardCategory, string> = {
  all: "Your turn",
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
    sub: "Your authored open PRs will show up here.",
  },
};

const BUCKET_ORDER: AgeBucket[] = ["today", "week", "older"];
const BUCKET_LABEL: Record<AgeBucket, string> = {
  today: "Today",
  week: "This week",
  older: "Older",
};

type DashboardGroupBy = "timeline" | "repo" | "org";

const GROUP_OPTIONS: Array<{ value: DashboardGroupBy; label: string }> = [
  { value: "timeline", label: "Timeline" },
  { value: "repo", label: "Repo" },
  { value: "org", label: "Org" },
];

export function DashboardView() {
  const [category, setCategory] = useState<DashboardCategory>("all");
  const [repo, setRepo] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<DashboardGroupBy>("timeline");

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

  const sections = useMemo(
    () => buildDashboardSections(category, filtered, groupBy),
    [category, filtered, groupBy],
  );

  const isPending = yourTurn.isPending || myPrs.isPending;
  const isError = yourTurn.isError || myPrs.isError;
  const { items: shownSections, listProps } = useStableList(sections, {
    key: (section) => section.key,
    resetKey: `${category}:${repo}:${groupBy}`,
    merge: (held, current) => ({
      ...current,
      entries: holdListOrder(held.entries, filtered, (entry) => `${entry.kind}:${entry.item.id}`),
    }),
  });
  useListNavigation(!isPending && !isError);

  return (
    <section className="flex min-h-full min-w-0 flex-col">
      <Container className="py-6">
        <div className="flex flex-col gap-6 @3xl/pane:flex-row @3xl/pane:items-start @3xl/pane:gap-8">
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
          <div className="min-w-0 flex-1">
            <MainHeader
              title={CATEGORY_TITLES[category]}
              shown={shownSections.reduce((count, section) => count + section.entries.length, 0)}
              total={counts[category] ?? null}
              groupBy={groupBy}
              onGroupByChange={setGroupBy}
              repo={repo}
              onClearRepo={() => setRepo(null)}
            />

            {isPending ? (
              <RowsSkeleton />
            ) : isError ? (
              <ErrorState />
            ) : shownSections.length === 0 ? (
              <EmptyState category={category} repo={repo} />
            ) : (
              <LiveUpdates ready={!isPending} announce={false}>
                <div className="flex flex-col gap-7" {...listProps}>
                  {shownSections.map((section) => (
                    <DashboardSection key={section.key} section={section} />
                  ))}
                </div>
              </LiveUpdates>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}

// ─── Group by bucket (post-filter) ─────────────────────────────────────────
//
// Same age-bucket logic as the helper, but operates on DashEntry (the
// post-filter pool element) rather than DashboardItem so we can pass entries
// through to DashRow with their `kind` tag intact for the date-axis pick.

type DashboardSectionData = {
  key: string;
  title: string;
  titleKind: "time" | "entity";
  avatarLogin?: string;
  entries: DashEntry[];
  showReason: boolean;
};

function buildDashboardSections(
  category: DashboardCategory,
  entries: DashEntry[],
  groupBy: DashboardGroupBy,
): DashboardSectionData[] {
  if (groupBy === "timeline") {
    return groupByTimeline(entries, category);
  }

  if (groupBy === "repo") {
    return groupByKey(
      entries,
      category,
      (entry) => `${entry.item.ownerRepo.owner}/${entry.item.ownerRepo.repo}`,
      "repo",
    );
  }

  return groupByKey(entries, category, (entry) => entry.item.ownerRepo.owner, "org");
}

function groupByTimeline(
  entries: DashEntry[],
  category: DashboardCategory,
): DashboardSectionData[] {
  const map = new Map<AgeBucket, DashEntry[]>();
  for (const entry of entries) {
    const bucket = ageBucket(pickDate(entry));
    const list = map.get(bucket) ?? [];
    list.push(entry);
    map.set(bucket, list);
  }

  const sections: DashboardSectionData[] = [];
  for (const bucket of BUCKET_ORDER) {
    const bucketEntries = map.get(bucket);
    if (!bucketEntries?.length) continue;
    sections.push({
      key: bucket,
      title: BUCKET_LABEL[bucket],
      titleKind: "time",
      entries: bucketEntries,
      showReason: category === "all",
    });
  }
  return sections;
}

function groupByKey(
  entries: DashEntry[],
  category: DashboardCategory,
  getKey: (entry: DashEntry) => string,
  groupKind: "repo" | "org",
): DashboardSectionData[] {
  const map = new Map<string, DashEntry[]>();
  for (const entry of entries) {
    const key = getKey(entry);
    const list = map.get(key) ?? [];
    list.push(entry);
    map.set(key, list);
  }

  return [...map.entries()]
    .sort(([aKey, aEntries], [bKey, bEntries]) => {
      const countDelta = bEntries.length - aEntries.length;
      if (countDelta !== 0) return countDelta;
      return aKey.localeCompare(bKey);
    })
    .map(([key, grouped]) => ({
      key,
      title: key,
      titleKind: "entity",
      avatarLogin: groupKind === "repo" ? key.split("/", 1)[0] : key,
      entries: grouped,
      showReason: category === "all",
    }));
}

// ─── Layout pieces ─────────────────────────────────────────────────────────

function MainHeader({
  title,
  shown,
  total,
  groupBy,
  onGroupByChange,
  repo,
  onClearRepo,
}: {
  title: string;
  shown: number;
  total: number | null;
  groupBy: DashboardGroupBy;
  onGroupByChange: (next: DashboardGroupBy) => void;
  repo: string | null;
  onClearRepo: () => void;
}) {
  return (
    <header className="mb-4 flex flex-wrap items-center gap-3">
      <h1 className="text-heading font-[475] tracking-tight text-foreground">{title}</h1>
      {total !== null ? (
        <span className="text-caption text-muted-foreground">
          <span className="font-mono tabular-nums">{shown}</span>
          {repo ? (
            <>
              {" in "}
              <span className="font-mono">{repo}</span>
            </>
          ) : null}
        </span>
      ) : null}

      <div className="ml-auto flex max-w-full flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-lg bg-muted px-2 py-1">
          <span className="text-caption text-muted-foreground">Group</span>
          <ToggleGroup
            type="single"
            value={groupBy}
            onValueChange={(value) => {
              if (isDashboardGroupBy(value)) onGroupByChange(value);
            }}
            size="sm"
            className="rounded-md bg-background p-0.5"
            aria-label="Group dashboard"
          >
            {GROUP_OPTIONS.map((option) => (
              <ToggleGroupItem
                key={option.value}
                value={option.value}
                aria-label={`Group by ${option.label.toLowerCase()}`}
                className="h-6 rounded px-2 text-caption data-[state=on]:bg-muted"
              >
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        {repo ? (
          <button
            type="button"
            onClick={onClearRepo}
            className="h-7 rounded-md px-2 text-caption text-muted-foreground outline-none transition-colors hover:bg-background hover:text-foreground focus-visible:ring-1 focus-visible:ring-(--color-focus)"
          >
            Clear repo filter
          </button>
        ) : null}
      </div>
    </header>
  );
}

function isDashboardGroupBy(value: string): value is DashboardGroupBy {
  return value === "timeline" || value === "repo" || value === "org";
}

function DashboardSection({ section }: { section: DashboardSectionData }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex h-8 items-center gap-2 rounded-lg bg-muted px-3">
        {section.avatarLogin ? (
          <Avatar
            login={section.avatarLogin}
            avatarUrl={githubAvatar(section.avatarLogin)}
            size="sm"
          />
        ) : null}
        <h2
          className={cn(
            "min-w-0 truncate text-ui font-[475] text-foreground",
            section.titleKind === "entity" && "font-mono text-caption",
          )}
        >
          {section.title}
        </h2>
        <span className="ml-auto font-mono text-caption tabular-nums text-muted-foreground">
          {section.entries.length}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        {section.entries.map((entry) => (
          <DashRow
            key={`${entry.kind}-${entry.item.id}`}
            liveKey={`${entry.kind}:${entry.item.id}`}
            item={entry.item}
            date={pickDate(entry)}
            showReason={section.showReason && entry.kind === "turn"}
          />
        ))}
      </div>
    </section>
  );
}

function githubAvatar(login: string): string {
  return `https://github.com/${login}.png`;
}

function RowsSkeleton() {
  const widths = [76, 58, 84, 50, 70, 64, 78];
  return (
    <SkeletonGroup label="Loading dashboard activity" className="skeleton-fade flex flex-col">
      {widths.map((w) => (
        <div key={w} className="flex items-center gap-3 px-3 py-2">
          <Skeleton className="size-1.5 shrink-0 rounded-full" />
          <Skeleton className="size-3.5 shrink-0 rounded-full" />
          <Skeleton className="hidden h-3 @xl/pane:block" style={{ width: `${w / 4 + 6}%` }} />
          <Skeleton className="h-3.5 flex-1" style={{ maxWidth: `${w}%` }} />
          <Skeleton className="h-3 w-8" />
        </div>
      ))}
    </SkeletonGroup>
  );
}

function ErrorState() {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
      <span className="font-mono text-ui text-(--color-danger)">Couldn't load your dashboard.</span>
      <span className="text-caption text-muted-foreground">
        GitHub may be slow or your token may have expired.
      </span>
    </div>
  );
}

function EmptyState({ category, repo }: { category: DashboardCategory; repo: string | null }) {
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
