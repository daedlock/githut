import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { type RepoTabDef, RepoTabs } from "@/app/components/repo/RepoTabs";
import { AppShell } from "@/app/components/shell/AppShell";
import { ShellFooter } from "@/app/components/shell/ShellFooter";
import { ShellHeader } from "@/app/components/shell/ShellHeader";
import { UserMenu } from "@/app/components/shell/UserMenu";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { useMe } from "@/app/hooks/useMe";
import { logout } from "@/app/lib/auth";
import { useAuthStore } from "@/app/stores/auth";

export const Route = createFileRoute("/$owner/$repo")({
  beforeLoad: () => {
    if (!useAuthStore.getState().token) throw redirect({ to: "/login" });
  },
  component: RepoLayout,
});

function RepoLayout() {
  const { owner, repo } = Route.useParams();
  const { data: me } = useMe();

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
          <ShellHeader
            // No hairline here — the RepoTabs row below closes the header
            // assembly with a single bottom border. Two separators would
            // create a striped/telephone-wire look.
            bordered={false}
            subtitle={
              <span className="flex items-baseline gap-1.5 truncate">
                <span className="text-[var(--color-fg-muted)]">{owner}</span>
                <span className="text-[var(--color-fg-faint)]">/</span>
                <span className="font-medium text-[var(--color-fg)] truncate">{repo}</span>
              </span>
            }
            right={
              <>
                <ThemeToggle />
                <UserMenu login={me?.login} avatarUrl={me?.avatar_url} onSignOut={logout} />
              </>
            }
          />
          <RepoTabs owner={owner} repo={repo} tabs={tabs} />
        </div>
      }
      footer={<ShellFooter bordered origin="localhost:5173" />}
    >
      <Outlet />
    </AppShell>
  );
}
