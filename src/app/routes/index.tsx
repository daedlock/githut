import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { RepoListWidget } from "@/app/components/repo/RepoListWidget";
import { AppShell } from "@/app/components/shell/AppShell";
import { ShellFooter } from "@/app/components/shell/ShellFooter";
import { ShellHeader } from "@/app/components/shell/ShellHeader";
import { UserMenu } from "@/app/components/shell/UserMenu";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { useMe } from "@/app/hooks/useMe";
import { useRepos } from "@/app/hooks/useRepos";
import { logout } from "@/app/lib/auth";
import { useAuthStore } from "@/app/stores/auth";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (!useAuthStore.getState().token) throw redirect({ to: "/login" });
  },
  component: IndexPage,
});

function IndexPage() {
  const { data: me } = useMe();
  const repos = useRepos();
  const navigate = useNavigate();

  return (
    <AppShell
      header={
        <ShellHeader
          bordered
          subtitle={me ? `@${me.login}` : undefined}
          right={
            <>
              <ThemeToggle />
              <UserMenu login={me?.login} avatarUrl={me?.avatar_url} onSignOut={logout} />
            </>
          }
        />
      }
      footer={<ShellFooter bordered origin="localhost:5173" />}
    >
      <div className="mx-auto w-full max-w-4xl px-6 py-6">
        <div className="grid grid-cols-1 gap-4">
          <RepoListWidget
            repos={repos.data}
            isPending={repos.isPending}
            onRepoClick={(repo) =>
              navigate({
                to: "/$owner/$repo",
                params: { owner: repo.owner.login, repo: repo.name },
              })
            }
          />
        </div>
      </div>
    </AppShell>
  );
}
