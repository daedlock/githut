import { useVirtualizer } from "@tanstack/react-virtual";
import { useNavigate } from "@tanstack/react-router";
import { AlertCircle, GitPullRequest } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { Container } from "@/app/components/ui/Container";
import { Skeleton } from "@/app/components/ui/skeleton";
import { Widget } from "@/app/components/ui/Widget";
import { PrFilters } from "@/app/features/pulls/components/PrFilters";
import { PrRow } from "@/app/features/pulls/components/PrRow";
import {
  type PullsFilters,
  type PullsSort,
  type PullsState,
  usePulls,
  usePullsCounts,
} from "@/app/features/pulls/hooks";

// ─── Constants ─────────────────────────────────────────────────────────────

const ROW_ESTIMATE = 68; // 2-line PR row with some labels
const OVERSCAN = 8;

// ─── Page ──────────────────────────────────────────────────────────────────

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

export function PrListPage({ owner, repo, search }: PrListPageProps) {
  const navigate = useNavigate();
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

  // ─── Virtualizer drives pagination (same pattern as Actions runs list) ──
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasNext = pulls.hasNextPage ?? false;
  const virtualizer = useVirtualizer({
    count: hasNext ? items.length + 1 : items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_ESTIMATE,
    overscan: OVERSCAN,
  });
  const virtualItems = virtualizer.getVirtualItems();

  useEffect(() => {
    const last = virtualItems.at(-1);
    if (!last) return;
    if (
      last.index >= items.length - 1 &&
      hasNext &&
      !pulls.isFetchingNextPage
    ) {
      pulls.fetchNextPage();
    }
  }, [virtualItems, items.length, hasNext, pulls.isFetchingNextPage, pulls.fetchNextPage]);

  // Widget meta — show the count for the current filter.
  const activeCount =
    filters.state === "open"
      ? counts.data?.open
      : filters.state === "closed"
        ? counts.data?.closed
        : undefined;

  const meta = pulls.isPending
    ? undefined
    : typeof activeCount === "number"
      ? `${items.length}${hasNext ? "+" : ""} / ${activeCount}`
      : `${items.length}${hasNext ? "+" : ""}`;

  return (
    <Container className="py-5 sm:py-6">
      <Widget
        title="Pull requests"
        meta={meta}
        actions={
          <PrFilters
            state={filters.state ?? "open"}
            sort={filters.sort ?? "newest"}
            counts={{ open: counts.data?.open, closed: counts.data?.closed }}
            onStateChange={(next) =>
              navigate({
                to: "/$owner/$repo/pulls",
                params: { owner, repo },
                search: (prev) => ({ ...prev, state: next === "open" ? undefined : next }),
              })
            }
            onSortChange={(next) =>
              navigate({
                to: "/$owner/$repo/pulls",
                params: { owner, repo },
                search: (prev) => ({ ...prev, sort: next === "newest" ? undefined : next }),
              })
            }
          />
        }
        bodyClassName="p-0"
      >
        {pulls.isPending ? (
          <PrListSkeleton />
        ) : pulls.isError ? (
          <ErrorState />
        ) : items.length === 0 ? (
          <EmptyState filters={filters} />
        ) : (
          <div
            ref={scrollRef}
            className="overflow-y-auto bg-background"
            style={{ height: "calc(100vh - 14rem)" }}
          >
            <div
              style={{
                height: virtualizer.getTotalSize(),
                position: "relative",
              }}
            >
              {virtualItems.map((v) => {
                const isLoaderRow = v.index >= items.length;
                const pr = items[v.index];
                return (
                  <div
                    key={v.key}
                    data-index={v.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      transform: `translateY(${v.start}px)`,
                    }}
                  >
                    {isLoaderRow ? (
                      <LoadMoreRow hasNext={hasNext} />
                    ) : pr ? (
                      <PrRow owner={owner} repo={repo} pr={pr} />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Widget>
    </Container>
  );
}

// ─── States ────────────────────────────────────────────────────────────────

function PrListSkeleton() {
  const widths = [70, 56, 80, 46, 66, 74];
  return (
    <div className="skeleton-fade">
      {widths.map((w) => (
        <div
          key={w}
          className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-b-0"
        >
          <Skeleton className="size-4 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <Skeleton className="h-3.5" style={{ width: `${w}%` }} />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function LoadMoreRow({ hasNext }: { hasNext: boolean }) {
  if (!hasNext) {
    return (
      <div className="flex items-center justify-center border-t border-border px-4 py-3">
        <span className="font-mono text-micro uppercase tracking-widest text-(--color-fg-faint)">
          End of pull requests
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3 border-b border-border px-4 py-3">
      <Skeleton className="size-4 shrink-0 rounded-full" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Skeleton className="h-3.5 w-1/2" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  );
}

function EmptyState({ filters }: { filters: PullsFilters }) {
  const state = filters.state ?? "open";
  const msg =
    state === "open"
      ? "No open pull requests."
      : state === "closed"
        ? "No closed pull requests."
        : "No pull requests match these filters.";
  return (
    <div className="px-4 py-12 text-center">
      <GitPullRequest className="mx-auto mb-2 size-5 text-(--color-fg-faint)" aria-hidden />
      <p className="font-mono text-ui text-muted-foreground">{msg}</p>
    </div>
  );
}

function ErrorState() {
  return (
    <div className="px-4 py-12 text-center">
      <AlertCircle className="mx-auto mb-2 size-5 text-destructive" aria-hidden />
      <p className="text-ui text-muted-foreground">Could not load pull requests.</p>
    </div>
  );
}
