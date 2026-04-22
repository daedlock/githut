import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, Play } from "lucide-react";
import { z } from "zod";
import { Container } from "@/app/components/ui/Container";
import { Skeleton } from "@/app/components/ui/skeleton";
import { RunFilters } from "@/app/features/actions/components/RunFilters";
import { RunRow } from "@/app/features/actions/components/RunRow";
import { WorkflowSidebar } from "@/app/features/actions/components/WorkflowSidebar";
import {
  type RunsFilters,
  useWorkflowRuns,
  useWorkflows,
  workflowRunsQueryOptions,
} from "@/app/features/actions/hooks";

// ─── Search params ─────────────────────────────────────────────────────────
//
// All filters live here. Back/forward work, deep links preserve state,
// and the cache key (which embeds filters) means a filter flip is a cache
// hit once warmed.

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

export const Route = createFileRoute("/$owner/$repo/actions/")({
  validateSearch: searchSchema,
  // Runs list is the primary surface — prefetch with the current filter set
  // so hover on "Actions" tab warms the exact query the page will read.
  loaderDeps: ({ search }) => search,
  loader: ({ context, params, deps }) =>
    context.queryClient.ensureQueryData(
      workflowRunsQueryOptions(params.owner, params.repo, toFilters(deps)),
    ),
  component: ActionsPage,
});

function ActionsPage() {
  const { owner, repo } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const workflowsQuery = useWorkflows(owner, repo);
  const runsQuery = useWorkflowRuns(owner, repo, toFilters(search));

  return (
    <Container className="py-6">
      <header className="mb-4 flex items-center gap-2">
        <Play className="size-4 text-muted-foreground" aria-hidden />
        <h1 className="font-mono text-ui font-medium uppercase tracking-widest text-foreground">
          Actions
        </h1>
      </header>

      <div className="flex gap-6 items-start">
        <WorkflowSidebar
          owner={owner}
          repo={repo}
          workflows={workflowsQuery.data}
          isPending={workflowsQuery.isPending}
          selectedId={search.workflow ?? null}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <RunFilters
            status={search.status ?? "all"}
            branch={search.branch}
            event={search.event}
            actor={search.actor}
            resultCount={runsQuery.data ? runsQuery.data.length : null}
            onStatusChange={(next) =>
              navigate({
                search: (prev) => ({ ...prev, status: next === "all" ? undefined : next }),
              })
            }
            onClearAll={() => navigate({ search: { workflow: search.workflow } })}
          />

          <section className="overflow-hidden rounded-md border border-border bg-background">
            {runsQuery.isPending ? (
              <RunListSkeleton />
            ) : runsQuery.isError ? (
              <ErrorState />
            ) : !runsQuery.data || runsQuery.data.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="flex flex-col">
                {runsQuery.data.map((run) => (
                  <RunRow key={run.id} owner={owner} repo={repo} run={run} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </Container>
  );
}

function RunListSkeleton() {
  const widths = [68, 54, 76, 48, 62, 70];
  return (
    <div className="skeleton-fade flex flex-col">
      {widths.map((w) => (
        <div
          key={w}
          className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-b-0"
        >
          <Skeleton className="size-5 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-4" style={{ width: `${w}%` }} />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="px-4 py-12 text-center">
      <Play className="mx-auto mb-2 size-5 text-(--color-fg-faint)" />
      <p className="font-mono text-ui text-muted-foreground">No runs match these filters.</p>
    </div>
  );
}

function ErrorState() {
  return (
    <div className="px-4 py-12 text-center">
      <AlertCircle className="mx-auto mb-2 size-5 text-destructive" />
      <p className="text-ui text-muted-foreground">Could not load runs.</p>
      <p className="mt-1 text-caption text-(--color-fg-faint)">
        Your OAuth token may be missing the <code>actions:read</code> scope.
      </p>
    </div>
  );
}
