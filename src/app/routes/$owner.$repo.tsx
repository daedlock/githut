import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";

import { RepoSubTabs } from "@/app/components/repo/RepoSubTabs";
import { AppShell } from "@/app/components/shell/AppShell";
import { ShellFooter } from "@/app/components/shell/ShellFooter";
import { TopBar } from "@/app/components/shell/TopBar";
import { useAuthStore } from "@/app/stores/auth";
import { useTabsStore } from "@/app/stores/tabs";

export const Route = createFileRoute("/$owner/$repo")({
  beforeLoad: () => {
    if (!useAuthStore.getState().token) throw redirect({ to: "/login" });
  },
  component: RepoLayout,
});

function RepoLayout() {
  const { owner, repo } = Route.useParams();

  return (
    <AppShell
      header={
        <div className="flex flex-col">
          <TopBar bordered={false} />
          <RepoSubTabs owner={owner} repo={repo} />
        </div>
      }
      footer={<ShellFooter bordered origin="localhost:5173" />}
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
