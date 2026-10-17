import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { repoQueryOptions } from "@/app/hooks/useRepo";
import { useAuthStore } from "@/app/stores/auth";

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

// Repo identity and sections live in the island header and title bar (see
// TabHost), so the layout itself is just the page.
function RepoLayout() {
  return (
    <main className="flex min-h-full min-w-0 flex-col">
      <Outlet />
    </main>
  );
}
