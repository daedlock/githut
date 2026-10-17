import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/app/components/shell/AppShell";
import { UnifiedNav } from "@/app/components/shell/UnifiedNav";
import { repoQueryOptions } from "@/app/hooks/useRepo";
import { useAuthStore } from "@/app/stores/auth";

// Sticky content follows the header's second row on narrow screens.

export const Route = createFileRoute("/$owner/$repo")({
  beforeLoad: () => {
    if (!useAuthStore.getState().token) throw redirect({ to: "/login" });
  },
  // Non-blocking prefetch — warms the cache on hover (preload: "intent")
  // and on click without awaiting, so the route transitions instantly and
  // child components get to render their own skeletons while the fetch
  // completes. Repo metadata is needed by every child (for `default_branch`
  // and the sidebar), so it's prefetched here once and children reuse it.
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(repoQueryOptions(params.owner, params.repo));
  },
  component: RepoLayout,
});

function RepoLayout() {
  const { owner, repo } = Route.useParams();

  return (
    <AppShell
      header={<UnifiedNav repoContext={{ owner, repo }} />}
      className="[--app-header-height:80px] md:[--app-header-height:40px]"
      stickyHeader
    >
      <Outlet />
    </AppShell>
  );
}
