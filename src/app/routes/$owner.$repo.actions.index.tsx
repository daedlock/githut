import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, Play, RefreshCw } from "lucide-react";
import { useMemo } from "react";
import { z } from "zod";
import { Button } from "@/app/components/ui/button";
import { Container } from "@/app/components/ui/Container";
import { Skeleton } from "@/app/components/ui/skeleton";
import { DispatchBar } from "@/app/features/actions/components/DispatchBar";
import { RunFilters } from "@/app/features/actions/components/RunFilters";
import { RunRow } from "@/app/features/actions/components/RunRow";
import { WorkflowSidebar } from "@/app/features/actions/components/WorkflowSidebar";
import {
  RUN_STATUSES,
  type RunsFilters,
  useWorkflowRuns,
  useWorkflows,
  workflowRunsQueryOptions,
} from "@/app/features/actions/hooks";
import { isTerminal, toUiStatus } from "@/app/features/actions/lib/statusMap";
import { useListNavigation } from "@/app/hooks/useListNavigation";
import { cn } from "@/app/lib/cn";

// ─── Search params ─────────────────────────────────────────────────────────

const searchSchema = z.object({
  workflow: z.coerce.number().int().positive().optional(),
  status: z.enum(RUN_STATUSES).optional(),
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
      ? (workflowsQuery.data?.find((w) => w.id === search.workflow) ?? null)
      : null;

  // Flatten pages once — cheap enough at 30/page even on very active repos.
  const runs = useMemo(
    () => [...new Map((runsQuery.data?.pages.flat() ?? []).map((run) => [run.id, run])).values()],
    [runsQuery.data],
  );
  useListNavigation(!runsQuery.isPending && !runsQuery.isError);

  const liveCount = useMemo(
    () =>
      runs.filter((r) => {
        const u = toUiStatus(r.status, r.conclusion);
        return !isTerminal(u);
      }).length,
    [runs],
  );

  const hasNext = runsQuery.hasNextPage ?? false;

  const meta = runsQuery.isPending
    ? null
    : liveCount > 0
      ? `${runs.length}${hasNext ? "+" : ""} · ${liveCount} live`
      : `${runs.length}${hasNext ? "+" : ""}`;

  return (
    <Container className="py-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        {/* Sidebar — unframed, sticky, RepoAbout-style vocabulary */}
        <div className="hidden w-56 shrink-0 self-start lg:block lg:sticky lg:top-28 lg:mt-12">
          <WorkflowSidebar
            owner={owner}
            repo={repo}
            workflows={workflowsQuery.data}
            isPending={workflowsQuery.isPending}
            isError={workflowsQuery.isError}
            selectedId={search.workflow ?? null}
          />
          {workflowsQuery.isError ? (
            <div role="alert" className="mt-2 text-caption text-destructive">
              Could not refresh workflows.{" "}
              <button type="button" className="underline" onClick={() => workflowsQuery.refetch()}>
                Retry
              </button>
            </div>
          ) : null}
        </div>

        {/* Runs — flat dashboard-style list */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-4">
            <MainHeader title={selectedWorkflow?.name ?? "All workflows"} meta={meta} />
            <Button
              variant="ghost"
              size="sm"
              disabled={runsQuery.isFetching}
              onClick={() => runsQuery.refetch()}
            >
              <RefreshCw className={runsQuery.isFetching ? "motion-safe:animate-spin" : ""} />
              Refresh
            </Button>
          </div>
          <p className="mt-1 text-caption text-muted-foreground">
            Workflow runs, deployments, and checks. Updates automatically.
          </p>
          <select
            aria-label="Choose workflow"
            value={search.workflow ?? ""}
            onChange={(e) =>
              navigate({
                search: { workflow: e.target.value ? Number(e.target.value) : undefined },
              })
            }
            className="mt-4 h-9 w-full rounded-md border border-input bg-background px-2 text-ui lg:hidden"
          >
            <option value="">All workflows</option>
            {workflowsQuery.data?.map((workflow) => (
              <option key={workflow.id} value={workflow.id}>
                {workflow.name}
                {workflow.state === "active" ? "" : " (disabled)"}
              </option>
            ))}
          </select>
          {workflowsQuery.isError ? (
            <div role="alert" className="mt-2 text-caption text-destructive lg:hidden">
              Could not load workflows.{" "}
              <button type="button" className="underline" onClick={() => workflowsQuery.refetch()}>
                Retry
              </button>
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted px-2 py-1">
            <RunFilters
              status={search.status ?? "all"}
              branch={search.branch}
              event={search.event}
              actor={search.actor}
              onFiltersChange={(filters) =>
                navigate({ search: (prev) => ({ ...prev, ...filters }) })
              }
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
          </div>

          {selectedWorkflow ? (
            <div className="mt-3">
              <DispatchBar owner={owner} repo={repo} workflow={selectedWorkflow} />
            </div>
          ) : null}

          {runsQuery.isError && runsQuery.data ? (
            <div role="alert" className="mt-3 rounded-lg bg-muted p-3 text-ui text-destructive">
              Could not refresh runs. Showing the last received results.{" "}
              <button type="button" className="underline" onClick={() => runsQuery.refetch()}>
                Retry
              </button>
            </div>
          ) : null}
          <div className="mt-4 flex flex-col gap-1">
            {runsQuery.isPending ? (
              <RunListSkeleton />
            ) : runsQuery.isError && !runsQuery.data ? (
              <ErrorState
                retry={() => {
                  void runsQuery.refetch();
                }}
              />
            ) : runs.length === 0 ? (
              <EmptyState hasFilter={hasAnyFilter(search)} />
            ) : (
              <>
                {runs.map((run) => (
                  <RunRow key={run.id} owner={owner} repo={repo} run={run} />
                ))}
                {hasNext ? (
                  <LoadMoreButton
                    isFetching={runsQuery.isFetchingNextPage}
                    onClick={() => runsQuery.fetchNextPage()}
                  />
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </Container>
  );
}

// ─── States ────────────────────────────────────────────────────────────────

function MainHeader({ title, meta }: { title: string; meta: string | null }) {
  return (
    <header className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-1">
      <h1 className="text-heading font-[475] tracking-tight text-foreground">{title}</h1>
      {meta ? (
        <span className="font-mono text-caption tabular-nums text-muted-foreground">{meta}</span>
      ) : null}
    </header>
  );
}

function RunListSkeleton() {
  const widths = [68, 54, 76, 48, 62, 70, 56, 64];
  return (
    <div className="skeleton-fade">
      {widths.map((w) => (
        <div key={w} className="flex items-start gap-3 rounded-lg px-3 py-2.5">
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

function LoadMoreButton({ isFetching, onClick }: { isFetching: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isFetching}
      className={cn(
        "flex w-full items-center justify-center rounded-lg px-4 py-3 text-caption text-muted-foreground",
        "outline-none hover:bg-muted focus-visible:bg-muted",
        "disabled:cursor-wait",
      )}
    >
      {isFetching ? "Loading…" : "Load more"}
    </button>
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

function ErrorState({ retry }: { retry: () => void }) {
  return (
    <div className="px-4 py-12 text-center">
      <AlertCircle className="mx-auto mb-2 size-5 text-destructive" aria-hidden />
      <p className="text-ui text-muted-foreground">Could not load runs.</p>
      <Button variant="ghost" size="sm" className="mt-2" onClick={retry}>
        Retry
      </Button>
    </div>
  );
}

function hasAnyFilter(s: Search): boolean {
  return !!(s.status || s.branch || s.event || s.actor || s.workflow);
}
