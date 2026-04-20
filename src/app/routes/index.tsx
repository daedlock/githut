import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { RepoListWidget } from "@/app/components/repo/RepoListWidget";
import { AppShell } from "@/app/components/shell/AppShell";
import { ShellFooter } from "@/app/components/shell/ShellFooter";
import { TopBar } from "@/app/components/shell/TopBar";
import { Container } from "@/app/components/ui/Container";
import { useRepos } from "@/app/hooks/useRepos";
import { useAuthStore } from "@/app/stores/auth";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (!useAuthStore.getState().token) throw redirect({ to: "/login" });
  },
  component: IndexPage,
});

function IndexPage() {
  const repos = useRepos();
  const navigate = useNavigate();

  return (
    <AppShell
      header={<TopBar bordered />}
      footer={<ShellFooter bordered origin="localhost:5173" />}
    >
      <Container className="py-6">
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
      </Container>
    </AppShell>
  );
}
