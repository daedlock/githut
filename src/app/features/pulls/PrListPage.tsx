import { useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  ChevronDown,
  GitPullRequest,
  GitPullRequestClosed,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";
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
    <Container className="py-6">
      {/* Toolbar — sits on subtle surface */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted px-4 py-2.5">
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
              placeholder="Search…"
              className="h-7 w-44 pl-8 text-ui"
            />
          </div>

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
                "h-7 appearance-none rounded-sm bg-background",
                "pl-2 pr-6 font-sans text-caption text-muted-foreground outline-none",
                "hover:text-foreground",
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
        </div>
      </div>

      {/* List — flat rows, hover surface shift */}
      <div>
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
      </div>
    </Container>
  );
}

function PrListSkeleton() {
  const widths = [70, 56, 80, 46, 66, 74, 60];
  return (
    <div className="skeleton-fade">
      {widths.map((w) => (
        <div key={w} className="flex items-start gap-3 px-4 py-3">
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
    <div className="px-5 py-16 text-center">
      <Icon className="mx-auto mb-3 size-5 text-[var(--color-fg-faint)]" />
      <p className="text-body text-muted-foreground">
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
