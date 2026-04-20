import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { type RepoTabDef, RepoTabs } from "@/app/components/repo/RepoTabs";
import { AppShell } from "@/app/components/shell/AppShell";
import { ShellFooter } from "@/app/components/shell/ShellFooter";
import { TopBar } from "@/app/components/shell/TopBar";
import { useAuthStore } from "@/app/stores/auth";

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
          {/* No hairline on TopBar — the RepoTabs row below closes the
              header assembly with a single bottom border. */}
          <TopBar bordered={false} />
          <RepoTabs owner={owner} repo={repo} tabs={tabs} />
        </div>
      }
      footer={<ShellFooter bordered origin="localhost:5173" />}
    >
      <Outlet />
    </AppShell>
  );
}
