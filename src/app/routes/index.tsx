import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { HomeWelcome } from "@/app/components/HomeWelcome";
import { StatusMessage } from "@/app/components/StatusMessage";
import { AppShell } from "@/app/components/shell/AppShell";
import { ShellFooter } from "@/app/components/shell/ShellFooter";
import { ShellHeader } from "@/app/components/shell/ShellHeader";
import { UserMenu } from "@/app/components/shell/UserMenu";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { useMe } from "@/app/hooks/useMe";
import { logout } from "@/app/lib/auth";
import { useAuthStore } from "@/app/stores/auth";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (!useAuthStore.getState().token) throw redirect({ to: "/login" });
  },
  component: IndexPage,
});

function IndexPage() {
  const { data: me, isPending, error } = useMe();

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
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
        {isPending ? (
          <StatusMessage>Loading your GitHub identity…</StatusMessage>
        ) : error ? (
          <StatusMessage tone="danger">
            Couldn't reach GitHub: {error instanceof Error ? error.message : String(error)}
          </StatusMessage>
        ) : me ? (
          <>
            <HomeWelcome name={me.name ?? ""} login={me.login} />
            {import.meta.env.DEV ? (
              <Link
                to="/playground"
                className="font-mono text-xs text-[var(--color-fg-faint)] underline underline-offset-4 hover:text-[var(--color-fg)]"
              >
                /playground
              </Link>
            ) : null}
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
