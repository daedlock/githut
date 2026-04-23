import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { RepoListWidget } from "@/app/components/repo/RepoListWidget";
import { AppShell } from "@/app/components/shell/AppShell";
import { ShellFooter } from "@/app/components/shell/ShellFooter";
import { UnifiedNav } from "@/app/components/shell/UnifiedNav";
import { Container } from "@/app/components/ui/Container";
import { reposQueryOptions, useRepos } from "@/app/hooks/useRepos";
import { useAuthStore } from "@/app/stores/auth";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (!useAuthStore.getState().token) throw redirect({ to: "/login" });
  },
  // Fire-and-forget prefetch — warms the cache on hover (preload: "intent")
  // without blocking the route transition. The component handles its own
  // pending state with a skeleton so cold navigations show loading UI.
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(reposQueryOptions());
  },
  component: IndexPage,
});

function IndexPage() {
  const repos = useRepos();
  const navigate = useNavigate();

  return (
    <AppShell header={<UnifiedNav />} footer={<div></div>}>
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
