import { useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  ChevronDown,
  GitPullRequest,
  GitPullRequestClosed,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Card, CardBody, CardHeader } from "@/app/components/ui/Card";
import { Container } from "@/app/components/ui/Container";
import { Input } from "@/app/components/ui/input";
import { Skeleton } from "@/app/components/ui/skeleton";
import { PrRow } from "@/app/features/pulls/components/PrRow";
import { PrStateTab } from "@/app/features/pulls/components/PrStateTab";
import {
  type PullsFilters,
  type PullsSort,
  type PullsState,
  usePulls,
  usePullsCounts,
} from "@/app/features/pulls/hooks";
import { cn } from "@/app/lib/cn";

// ─── PR list page ──────────────────────────────────────────────────────────
//
// Mirrors the Issues list layout:
//   Card (radius=lg, tone=subtle, border=strong)
//     CardHeader — [Open N] [Closed N]  │  Search  Sort
//     CardBody (flush, divided) — PrRow rows or empty/error state
//
// Local-only search filters the already-loaded pages by title + author;
// hitting the network for each keystroke would be wasteful and the "N /
// total" count from the server is still exposed via the tab counter.
//
// Pagination uses the "Load more" sentinel below the last row instead of
// a virtualizer — matches Issues (which doesn't virtualize) and keeps the
// layout simpler for typical repos (<500 PRs). Very active repos trade a
// bit of DOM for consistency with the Issues page feel.

export type PrListPageProps = {
  owner: string;
  repo: string;
  search: {
    state?: PullsState;
    author?: string;
    label?: string;
    reviewer?: string;
    assignee?: string;
    sort?: PullsSort;
  };
};

const SORT_OPTIONS: { value: PullsSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "updated", label: "Recently updated" },
  { value: "comments", label: "Most commented" },
];

export function PrListPage({ owner, repo, search }: PrListPageProps) {
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState("");

  const filters: PullsFilters = {
    state: search.state ?? "open",
    author: search.author,
    label: search.label,
    reviewer: search.reviewer,
    assignee: search.assignee,
    sort: search.sort ?? "newest",
  };

  const pulls = usePulls(owner, repo, filters);
  const counts = usePullsCounts(owner, repo);

  const items = useMemo(() => pulls.data?.pages.flat() ?? [], [pulls.data]);

  // Local filter over loaded pages — same UX as Issues' search.
  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (pr) =>
        pr.title.toLowerCase().includes(q) ||
        pr.user?.login.toLowerCase().includes(q) ||
        pr.labels.some((l) => l.name.toLowerCase().includes(q)),
    );
  }, [items, searchText]);

  const currentState = (filters.state ?? "open") as PullsState;

  return (
    <Container className="py-5 sm:py-6">
      <Card radius="lg" tone="subtle" border="strong">
        <CardHeader className="sm:px-5">
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <div className="flex items-center">
              <PrStateTab
                state="open"
                count={counts.data?.open}
                isActive={currentState === "open"}
                onClick={() =>
                  navigate({
                    to: "/$owner/$repo/pulls",
                    params: { owner, repo },
                    search: (prev) => ({ ...prev, state: undefined }),
                  })
                }
              />
              <PrStateTab
                state="closed"
                count={counts.data?.closed}
                isActive={currentState === "closed"}
                onClick={() =>
                  navigate({
                    to: "/$owner/$repo/pulls",
                    params: { owner, repo },
                    search: (prev) => ({ ...prev, state: "closed" }),
                  })
                }
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Search pull requests…"
                  className="h-8 w-52 pl-8 text-ui"
                />
              </div>

              <label className="inline-flex items-center gap-1.5 text-caption text-muted-foreground">
                <span>Sort</span>
                <div className="relative">
                  <select
                    value={filters.sort ?? "newest"}
                    onChange={(e) =>
                      navigate({
                        to: "/$owner/$repo/pulls",
                        params: { owner, repo },
                        search: (prev) => ({
                          ...prev,
                          sort:
                            e.target.value === "newest"
                              ? undefined
                              : (e.target.value as PullsSort),
                        }),
                      })
                    }
                    className={cn(
                      "h-8 appearance-none rounded-md border border-input bg-background",
                      "pl-2 pr-6 font-sans text-ui text-foreground outline-none",
                      "focus-visible:ring-1 focus-visible:ring-(--color-focus)",
                    )}
                  >
                    {SORT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-1.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                </div>
              </label>
            </div>
          </div>
        </CardHeader>

        <CardBody
          flush
          className="divide-y divide-border overflow-hidden rounded-b-[var(--radius-lg)] bg-background"
        >
          {pulls.isPending ? (
            <PrListSkeleton />
          ) : pulls.isError ? (
            <div className="px-5 py-10 text-center">
              <AlertCircle className="mx-auto mb-2 size-5 text-destructive" />
              <p className="text-body text-muted-foreground">Could not load pull requests.</p>
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState hasSearch={!!searchText} state={currentState} />
          ) : (
            <>
              {filtered.map((pr) => (
                <PrRow key={pr.id} owner={owner} repo={repo} pr={pr} />
              ))}
              {pulls.hasNextPage && !searchText ? (
                <LoadMoreButton
                  isFetching={pulls.isFetchingNextPage}
                  onClick={() => pulls.fetchNextPage()}
                />
              ) : null}
            </>
          )}
        </CardBody>
      </Card>
    </Container>
  );
}

// ─── States ────────────────────────────────────────────────────────────────

function PrListSkeleton() {
  const widths = [70, 56, 80, 46, 66, 74, 60];
  return (
    <div className="skeleton-fade">
      {widths.map((w) => (
        <div
          key={w}
          className="flex items-start gap-3 px-4 py-3.5 sm:px-5"
        >
          <Skeleton className="size-4 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5" style={{ width: `${w}%` }} />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  hasSearch,
  state,
}: {
  hasSearch: boolean;
  state: PullsState;
}) {
  const Icon = state === "open" ? GitPullRequest : GitPullRequestClosed;
  return (
    <div className="px-5 py-12 text-center">
      <Icon className="mx-auto mb-3 size-6 text-[var(--color-fg-faint)]" />
      <p className="text-body font-medium text-muted-foreground">
        {hasSearch
          ? "No pull requests match your search."
          : state === "open"
            ? "No open pull requests."
            : "No closed pull requests."}
      </p>
    </div>
  );
}

function LoadMoreButton({
  isFetching,
  onClick,
}: {
  isFetching: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isFetching}
      className={cn(
        "flex w-full items-center justify-center px-4 py-3 text-caption text-muted-foreground",
        "outline-none hover:bg-muted focus-visible:bg-muted",
        "disabled:cursor-wait",
      )}
    >
      {isFetching ? "Loading…" : "Load more"}
    </button>
  );
}
