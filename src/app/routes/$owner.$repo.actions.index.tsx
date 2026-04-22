import { useVirtualizer } from "@tanstack/react-virtual";
import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, Play } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { z } from "zod";
import { Container } from "@/app/components/ui/Container";
import { Skeleton } from "@/app/components/ui/skeleton";
import { Widget } from "@/app/components/ui/Widget";
import { DispatchBar } from "@/app/features/actions/components/DispatchBar";
import { RunFilters } from "@/app/features/actions/components/RunFilters";
import { RunRow } from "@/app/features/actions/components/RunRow";
import { WorkflowSidebar } from "@/app/features/actions/components/WorkflowSidebar";
import {
  type RunsFilters,
  useWorkflowRuns,
  useWorkflows,
  workflowRunsQueryOptions,
} from "@/app/features/actions/hooks";
import { toUiStatus } from "@/app/features/actions/lib/statusMap";

// ─── Search params ─────────────────────────────────────────────────────────

const STATUS_VALUES = [
  "queued",
  "in_progress",
  "completed",
  "success",
  "failure",
  "cancelled",
] as const;

const searchSchema = z.object({
  workflow: z.coerce.number().int().positive().optional(),
  status: z.enum(STATUS_VALUES).optional(),
  branch: z.string().optional(),
  event: z.string().optional(),
  actor: z.string().optional(),
});

type Search = z.infer<typeof searchSchema>;

function toFilters(s: Search): RunsFilters {
  return {
    workflowId: s.workflow,
    status: s.status,
    branch: s.branch,
    event: s.event,
    actor: s.actor,
  };
}

// ─── Route ─────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/$owner/$repo/actions/")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => search,
  // Non-blocking: fire the prefetch, return undefined so the router
  // transitions instantly. The component handles its own pending state —
  // filter flips feel instant because the URL change re-renders the UI
  // before the network ever finishes.
  loader: ({ context, params, deps }) => {
    void context.queryClient.prefetchInfiniteQuery(
      workflowRunsQueryOptions(params.owner, params.repo, toFilters(deps)),
    );
  },
  component: ActionsPage,
});

// ─── Virtualization constants ──────────────────────────────────────────────

const RUN_ROW_ESTIMATE = 56; // RunRow ≈ 56px (2-line row + py-2.5)
const OVERSCAN = 8;

// ─── Page ──────────────────────────────────────────────────────────────────

function ActionsPage() {
  const { owner, repo } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const workflowsQuery = useWorkflows(owner, repo);
  const runsQuery = useWorkflowRuns(owner, repo, toFilters(search));

  // If a specific workflow is selected, look it up so the dispatch bar can
  // render its name + path into the schema lookup. `All workflows` (null)
  // never shows the bar.
  const selectedWorkflow =
    search.workflow != null
      ? workflowsQuery.data?.find((w) => w.id === search.workflow) ?? null
      : null;

  // Flatten pages once — cheap enough at 30/page even on very active repos.
  const runs = useMemo(
    () => runsQuery.data?.pages.flat() ?? [],
    [runsQuery.data],
  );

  const liveCount = useMemo(
    () =>
      runs.filter((r) => {
        const u = toUiStatus(r.status, r.conclusion);
        return u.kind === "running" || u.kind === "queued";
      }).length,
    [runs],
  );

  // ─── Virtualizer drives pagination ───────────────────────────────────────
  //
  // Canonical TanStack pattern: the virtualizer reports which rows are
  // visible; when the last one is near, kick `fetchNextPage`. No separate
  // sentinel element required.

  const scrollRef = useRef<HTMLDivElement>(null);
  const hasNext = runsQuery.hasNextPage ?? false;
  const virtualizer = useVirtualizer({
    count: hasNext ? runs.length + 1 : runs.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => RUN_ROW_ESTIMATE,
    overscan: OVERSCAN,
  });

  const virtualItems = virtualizer.getVirtualItems();

  useEffect(() => {
    const last = virtualItems.at(-1);
    if (!last) return;
    if (
      last.index >= runs.length - 1 &&
      hasNext &&
      !runsQuery.isFetchingNextPage
    ) {
      runsQuery.fetchNextPage();
    }
  }, [virtualItems, runs.length, hasNext, runsQuery.isFetchingNextPage, runsQuery.fetchNextPage]);

  // Widget meta conveys total + live without extra chrome. "+" suffix hints
  // more pages are loadable without needing a separate "show more" affordance.
  const meta = runsQuery.isPending
    ? undefined
    : liveCount > 0
      ? `${runs.length}${hasNext ? "+" : ""} · ${liveCount} live`
      : `${runs.length}${hasNext ? "+" : ""}`;

  return (
    <Container className="py-5 sm:py-6">
      <div className="flex items-start gap-6">
        {/* Sidebar — unframed, sticky, RepoAbout-style vocabulary */}
        <div className="hidden w-48 shrink-0 sm:block">
          <WorkflowSidebar
            owner={owner}
            repo={repo}
            workflows={workflowsQuery.data}
            isPending={workflowsQuery.isPending}
            selectedId={search.workflow ?? null}
          />
        </div>

        {/* Runs — virtualized list inside a Widget */}
        <div className="min-w-0 flex-1 flex flex-col gap-3">
          {selectedWorkflow ? (
            <DispatchBar owner={owner} repo={repo} workflow={selectedWorkflow} />
          ) : null}

          <Widget
            title="Actions"
            meta={meta}
            actions={
              <RunFilters
                status={search.status ?? "all"}
                branch={search.branch}
                event={search.event}
                actor={search.actor}
                onStatusChange={(next) =>
                  navigate({
                    search: (prev) => ({
                      ...prev,
                      status: next === "all" ? undefined : next,
                    }),
                  })
                }
                onClear={(field) =>
                  navigate({
                    search: (prev) => ({ ...prev, [field]: undefined }),
                  })
                }
              />
            }
            bodyClassName="p-0"
          >
            {runsQuery.isPending ? (
              <RunListSkeleton />
            ) : runsQuery.isError ? (
              <ErrorState />
            ) : runs.length === 0 ? (
              <EmptyState hasFilter={hasAnyFilter(search)} />
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
                    const isLoaderRow = v.index >= runs.length;
                    const run = runs[v.index];

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
                        ) : run ? (
                          <RunRow owner={owner} repo={repo} run={run} />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Widget>
        </div>
      </div>
    </Container>
  );
}

// ─── States ────────────────────────────────────────────────────────────────

function RunListSkeleton() {
  const widths = [68, 54, 76, 48, 62, 70, 56, 64];
  return (
    <div className="skeleton-fade">
      {widths.map((w) => (
        <div
          key={w}
          className="flex items-start gap-3 border-b border-border px-4 py-2.5 last:border-b-0"
        >
          <Skeleton className="size-4 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <Skeleton className="h-3.5" style={{ width: `${w}%` }} />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <Skeleton className="h-3 w-10" />
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
          End of runs
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3 border-b border-border px-4 py-2.5">
      <Skeleton className="size-4 shrink-0 rounded-full" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Skeleton className="h-3.5 w-1/2" />
        <Skeleton className="h-3 w-2/3" />
      </div>
      <Skeleton className="h-3 w-10" />
    </div>
  );
}

function EmptyState({ hasFilter }: { hasFilter: boolean }) {
  return (
    <div className="px-4 py-12 text-center">
      <Play className="mx-auto mb-2 size-5 text-(--color-fg-faint)" aria-hidden />
      <p className="font-mono text-ui text-muted-foreground">
        {hasFilter ? "No runs match these filters." : "No workflow runs yet."}
      </p>
    </div>
  );
}

function ErrorState() {
  return (
    <div className="px-4 py-12 text-center">
      <AlertCircle className="mx-auto mb-2 size-5 text-destructive" aria-hidden />
      <p className="text-ui text-muted-foreground">Could not load runs.</p>
      <p className="mt-1 text-caption text-(--color-fg-faint)">
        Your token may be missing the{" "}
        <span className="font-mono text-(--color-fg-muted)">actions:read</span> scope.
      </p>
    </div>
  );
}

function hasAnyFilter(s: Search): boolean {
  return !!(s.status || s.branch || s.event || s.actor || s.workflow);
}
