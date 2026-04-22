import { createFileRoute, Outlet } from "@tanstack/react-router";
import { workflowsQueryOptions } from "@/app/features/actions/hooks";

export const Route = createFileRoute("/$owner/$repo/actions")({
  // Non-blocking prefetch so the sidebar has a warm cache by the time
  // children render. Children display their own skeletons if cold.
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(
      workflowsQueryOptions(params.owner, params.repo),
    );
  },
  component: ActionsLayout,
});

function ActionsLayout() {
  return <Outlet />;
}
