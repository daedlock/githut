import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { Button } from "@/app/components/ui/Button";
import { Kbd } from "@/app/components/ui/Kbd";
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
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-3">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-sm font-medium tracking-tight">GitHut</span>
          {me ? (
            <span className="font-mono text-xs text-[var(--color-fg-muted)]">@{me.login}</span>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          {me ? (
            <img
              src={me.avatar_url}
              alt={me.login}
              className="h-7 w-7 rounded-full border border-[var(--color-border-strong)]"
            />
          ) : null}
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            onClick={logout}
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
        {isPending ? (
          <p className="font-mono text-sm text-[var(--color-fg-muted)]">
            Loading your GitHub identity…
          </p>
        ) : error ? (
          <div className="space-y-3">
            <p className="font-mono text-sm text-[var(--color-danger)]">
              Couldn't reach GitHub: {error instanceof Error ? error.message : String(error)}
            </p>
            <Button variant="secondary" onClick={logout}>
              Sign out
            </Button>
          </div>
        ) : me ? (
          <div className="space-y-4">
            <h1 className="font-mono text-3xl font-medium tracking-tight">
              Welcome, <span className="text-[var(--color-accent)]">{me.name ?? me.login}</span>
            </h1>
            <p className="max-w-md text-sm text-[var(--color-fg-muted)]">
              Authenticated via GitHub. Token lives in your browser only — the Worker never sees it
              after callback.
            </p>
            {import.meta.env.DEV ? (
              <div className="pt-4">
                <Link
                  to="/playground"
                  className="font-mono text-xs text-[var(--color-fg-faint)] underline underline-offset-4 hover:text-[var(--color-fg)]"
                >
                  /playground
                </Link>
              </div>
            ) : null}
          </div>
        ) : null}
      </main>

      <footer className="flex items-center justify-between border-t border-[var(--color-border)] px-6 py-3 font-mono text-[10px] uppercase tracking-widest text-[var(--color-fg-faint)]">
        <span>localhost:5173</span>
        <div className="flex items-center gap-1.5">
          <Kbd>?</Kbd>
          <span className="text-[11px] normal-case tracking-normal">for shortcuts</span>
        </div>
      </footer>
    </div>
  );
}
