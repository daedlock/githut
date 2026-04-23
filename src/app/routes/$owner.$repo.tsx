import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";

import { AppShell } from "@/app/components/shell/AppShell";
import { ShellFooter } from "@/app/components/shell/ShellFooter";
import { UnifiedNav } from "@/app/components/shell/UnifiedNav";
import { repoQueryOptions } from "@/app/hooks/useRepo";
import { useAuthStore } from "@/app/stores/auth";
import { useTabsStore } from "@/app/stores/tabs";

// Child routes under /$owner/$repo whose own inner sticky chrome
// (e.g. DiffLayout's top bar) would otherwise stack below the repo bar.
// On these, we scroll the repo bar away instead of stacking stickies.
const NON_STICKY_HEADER_PATTERNS: RegExp[] = [/\/commit\/[0-9a-f]{4,40}\/?$/i];

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
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const stickyHeader = !NON_STICKY_HEADER_PATTERNS.some((re) => re.test(pathname));

  return (
    <AppShell
      header={<UnifiedNav repoContext={{ owner, repo }} />}
      footer={<ShellFooter bordered origin="localhost:5173" />}
      stickyHeader={stickyHeader}
    >
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
