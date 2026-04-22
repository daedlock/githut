import { createFileRoute, Outlet } from "@tanstack/react-router";
import { workflowsQueryOptions } from "@/app/features/actions/hooks";

export const Route = createFileRoute("/$owner/$repo/actions")({
  // Workflows list drives the sidebar on every child — prefetch it at the
  // parent so navigating between "all runs", a specific workflow, or a run
  // detail never waits for the sidebar to populate.
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      workflowsQueryOptions(params.owner, params.repo),
    ),
  component: ActionsLayout,
});

function ActionsLayout() {
  return <Outlet />;
}
