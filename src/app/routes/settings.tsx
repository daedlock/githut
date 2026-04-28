import { createFileRoute, redirect } from "@tanstack/react-router";
import { ThemePicker } from "@/app/components/settings/ThemePicker";
import { AppShell } from "@/app/components/shell/AppShell";
import { ShellFooter } from "@/app/components/shell/ShellFooter";
import { UnifiedNav } from "@/app/components/shell/UnifiedNav";
import { Container } from "@/app/components/ui/Container";
import { ProfileLink } from "@/app/components/user/ProfileLink";
import { useMe } from "@/app/hooks/useMe";
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
    <AppShell header={<UnifiedNav />} footer={<ShellFooter bordered origin="localhost:5173" />}>
      <Container className="py-6 sm:py-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
          <header className="flex flex-col gap-1">
            <h1 className="font-sans text-title font-medium tracking-tight text-foreground">
              Settings
            </h1>
            <p className="font-sans text-ui text-muted-foreground">
              Keep it simple for now. Appearance preferences are saved in this browser.
            </p>
          </header>

          <section className="flex flex-col gap-3 rounded-lg bg-muted p-4">
            <h2 className="font-sans text-ui font-medium text-foreground">Appearance</h2>
            <ThemePicker />
          </section>

          <WorkspaceTabsSection />

          <section className="flex flex-col gap-2 rounded-lg bg-muted p-4">
            <h2 className="font-sans text-ui font-medium text-foreground">Account</h2>
            <p className="font-sans text-ui text-muted-foreground">
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
    <section className="flex flex-col gap-3 rounded-lg bg-muted p-4">
      <h2 className="font-sans text-ui font-medium text-foreground">Workspace</h2>
      <div className="flex items-center justify-between gap-4">
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
