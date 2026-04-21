import { createFileRoute, redirect } from "@tanstack/react-router";
import { Settings as SettingsIcon } from "lucide-react";
import { NavVariantPicker } from "@/app/components/settings/NavVariantPicker";
import { ThemePicker } from "@/app/components/settings/ThemePicker";
import { AppShell } from "@/app/components/shell/AppShell";
import { ShellFooter } from "@/app/components/shell/ShellFooter";
import { ShellHeader } from "@/app/components/shell/ShellHeader";
import { UserMenu } from "@/app/components/shell/UserMenu";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { Container } from "@/app/components/ui/Container";
import { ProfileLink } from "@/app/components/user/ProfileLink";
import { useMe } from "@/app/hooks/useMe";
import { logout, manageGitHubAccess } from "@/app/lib/auth";
import { cn } from "@/app/lib/cn";
import { useAuthStore } from "@/app/stores/auth";
import { useSettingsStore } from "@/app/stores/settings";

export const Route = createFileRoute("/settings")({
  beforeLoad: () => {
    if (!useAuthStore.getState().token) throw redirect({ to: "/login" });
  },
  component: SettingsPage,
});

function SettingsPage() {
  const { data: me } = useMe();

  return (
    <AppShell
      header={
        <ShellHeader
          bordered
          subtitle={
            <span className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
              <SettingsIcon className="size-3" />
              settings
            </span>
          }
          right={
            <>
              <ThemeToggle />
              <UserMenu login={me?.login} avatarUrl={me?.avatar_url} onSignOut={logout} onReAuth={manageGitHubAccess} />
            </>
          }
        />
      }
      footer={<ShellFooter bordered origin="localhost:5173" />}
    >
      <Container className="py-6 sm:py-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
          <header className="flex flex-col gap-1">
            <h1 className="font-mono text-title font-medium tracking-tight text-foreground">
              Settings
            </h1>
            <p className="font-sans text-ui text-muted-foreground">
              Keep it simple for now. Appearance preferences are saved in this browser.
            </p>
          </header>

          <section className="rounded-md border border-border bg-background">
            <div className="border-b border-border px-4 py-3">
              <h2 className="font-mono text-micro uppercase tracking-widest text-muted-foreground">
                Appearance
              </h2>
            </div>
            <div className="px-4 py-4">
              <ThemePicker />
            </div>
          </section>

          <section className="rounded-md border border-border bg-background">
            <div className="border-b border-border px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-mono text-micro uppercase tracking-widest text-muted-foreground">
                  Navbar variant
                </h2>
                <span className="font-sans text-caption italic text-muted-foreground">
                  pick one — we're still evaluating
                </span>
              </div>
            </div>
            <div className="px-4 py-4">
              <NavVariantPicker />
            </div>
          </section>

          <WorkspaceTabsSection />

          <section className="rounded-md border border-border bg-background px-4 py-3">
            <div className="font-mono text-micro uppercase tracking-widest text-muted-foreground">
              Account
            </div>
            <p className="mt-2 font-sans text-ui text-muted-foreground">
              Signed in as{" "}
              <ProfileLink login={me?.login ?? ""} className="font-mono text-foreground">
                {me?.login ?? "…"}
              </ProfileLink>
              .
            </p>
          </section>
        </div>
      </Container>
    </AppShell>
  );
}

function WorkspaceTabsSection() {
  const tabsEnabled = useSettingsStore((s) => s.tabsEnabled);
  const setTabsEnabled = useSettingsStore((s) => s.setTabsEnabled);

  return (
    <section className="rounded-md border border-border bg-background">
      <div className="border-b border-border px-4 py-3">
        <h2 className="font-mono text-micro uppercase tracking-widest text-muted-foreground">
          Workspace
        </h2>
      </div>
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex flex-col gap-1">
          <span className="font-sans text-ui font-medium text-foreground">Workspace tabs</span>
          <span className="font-sans text-caption text-muted-foreground">
            Open pages in tabs for quick switching between repos, issues, and PRs.
          </span>
        </div>
        <button
          type="button"
          onClick={() => setTabsEnabled(!tabsEnabled)}
          role="switch"
          aria-checked={tabsEnabled}
          className={cn(
            "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-border transition-colors duration-150",
            tabsEnabled ? "bg-primary" : "bg-(--color-bg-sunken)",
          )}
        >
          <span
            className={cn(
              "pointer-events-none inline-block size-3.5 rounded-full bg-background transition-transform duration-150",
              tabsEnabled ? "translate-x-4" : "translate-x-0.5",
            )}
            style={{ marginTop: "2px" }}
          />
        </button>
      </div>
    </section>
  );
}
