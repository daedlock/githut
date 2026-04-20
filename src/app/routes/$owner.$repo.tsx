import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";

import { type RepoTabDef, RepoTabs } from "@/app/components/repo/RepoTabs";
import { AppShell } from "@/app/components/shell/AppShell";
import { ShellFooter } from "@/app/components/shell/ShellFooter";
import { TopBar } from "@/app/components/shell/TopBar";
import { useAuthStore } from "@/app/stores/auth";
import { useWorkspacesStore } from "@/app/stores/workspaces";

export const Route = createFileRoute("/$owner/$repo")({
  beforeLoad: () => {
    if (!useAuthStore.getState().token) throw redirect({ to: "/login" });
  },
  component: RepoLayout,
});

function RepoLayout() {
  const { owner, repo } = Route.useParams();

  const tabs: RepoTabDef[] = [
    { to: `/${owner}/${repo}/code`, label: "Code" },
    { to: `/${owner}/${repo}/commits`, label: "Commits" },
    { to: `/${owner}/${repo}/pulls`, label: "Pull requests" },
    { to: `/${owner}/${repo}/issues`, label: "Issues" },
  ];

  return (
    <AppShell
      header={
        <div className="flex flex-col">
          {/* No hairline on TopBar — RepoTabs below closes the assembly. */}
          <TopBar bordered={false} />
          <RepoTabs owner={owner} repo={repo} tabs={tabs} />
        </div>
      }
      footer={<ShellFooter bordered origin="localhost:5173" />}
    >
      <WorkspaceRegistrar owner={owner} repo={repo} />
      <Outlet />
    </AppShell>
  );
}

/**
 * Invisible side-effect: registers the current repo as a workspace entry,
 * keeps the stored href (pathname + search + hash) in sync, and restores
 * scroll position when the workspace is re-entered.
 */
function WorkspaceRegistrar({ owner, repo }: { owner: string; repo: string }) {
  const href = useRouterState({ select: (s) => s.location.href });
  const push = useWorkspacesStore((s) => s.push);
  const saveScroll = useWorkspacesStore((s) => s.saveScroll);
  const key = `${owner}/${repo}`;

  // Register / update the workspace entry whenever the URL changes.
  useEffect(() => {
    push(owner, repo, href);
  }, [owner, repo, href, push]);

  // Restore saved scroll position when this workspace mounts.
  useEffect(() => {
    const entry = useWorkspacesStore.getState().entries.find((e) => e.key === key);
    if (entry && entry.scrollY > 0) {
      // Wait one frame for content to render before scrolling.
      requestAnimationFrame(() => window.scrollTo(0, entry.scrollY));
    }
  }, [key]);

  // Save scroll position when leaving this workspace.
  useEffect(() => {
    return () => {
      saveScroll(key, window.scrollY);
    };
  }, [key, saveScroll]);

  return null;
}
