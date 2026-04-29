import { createFileRoute, Outlet } from "@tanstack/react-router";
import { repoIssuesQueryOptions } from "@/app/features/issues/hooks";

export const Route = createFileRoute("/$owner/$repo/issues")({
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(repoIssuesQueryOptions(params.owner, params.repo));
  },
  component: IssuesLayout,
});

function IssuesLayout() {
  return <Outlet />;
}
