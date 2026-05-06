import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";

import { AppShell } from "@/app/components/shell/AppShell";
import { UnifiedNav } from "@/app/components/shell/UnifiedNav";
import { repoQueryOptions } from "@/app/hooks/useRepo";
import { useAuthStore } from "@/app/stores/auth";
import { useTabsStore } from "@/app/stores/tabs";

// With the unified single-row nav, the header is always sticky.
// DiffLayout's own sticky bar sits below it at top-10.

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
    <AppShell header={<UnifiedNav repoContext={{ owner, repo }} />} stickyHeader>
      <TabScrollRegistrar />
      <Outlet />
    </AppShell>
  );
}

/**
 * Saves scroll position to the active tab on unmount,
 * restores it on mount. Replaces WorkspaceRegistrar.
 */
function TabScrollRegistrar() {
  const activeTabId = useTabsStore((s) => s.activeTabId);
  const saveScroll = useTabsStore((s) => s.saveScroll);

  // Restore scroll on mount
  useEffect(() => {
    if (!activeTabId) return;
    const tab = useTabsStore.getState().tabs.find((t) => t.id === activeTabId);
    if (tab && tab.scrollY > 0) {
      requestAnimationFrame(() => window.scrollTo(0, tab.scrollY));
    }
  }, [activeTabId]);

  // Save scroll on unmount
  useEffect(() => {
    return () => {
      const id = useTabsStore.getState().activeTabId;
      if (id) saveScroll(id, window.scrollY);
    };
  }, [saveScroll]);

  return null;
}
