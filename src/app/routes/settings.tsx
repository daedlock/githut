import { createFileRoute, redirect } from "@tanstack/react-router";
import { Settings as SettingsIcon } from "lucide-react";
import { ThemePicker } from "@/app/components/settings/ThemePicker";
import { AppShell } from "@/app/components/shell/AppShell";
import { ShellFooter } from "@/app/components/shell/ShellFooter";
import { ShellHeader } from "@/app/components/shell/ShellHeader";
import { UserMenu } from "@/app/components/shell/UserMenu";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { Container } from "@/app/components/ui/Container";
import { useMe } from "@/app/hooks/useMe";
import { logout } from "@/app/lib/auth";
import { useAuthStore } from "@/app/stores/auth";

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
            <span className="inline-flex items-center gap-1.5 font-mono text-xs text-[var(--color-fg-muted)]">
              <SettingsIcon className="h-3 w-3" />
              settings
            </span>
          }
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
      <Container className="py-8 sm:py-10">
        {/* Editorial masthead — Berkeley Mono, oversized, no decoration */}
        <header className="mb-10">
          <h1 className="font-mono text-[32px] font-medium leading-none tracking-tight text-[var(--color-fg)]">
            Settings
            <span className="text-[var(--color-accent)]">_</span>
          </h1>
          <p className="mt-2 font-sans text-sm text-[var(--color-fg-muted)]">
            Configure how GitHut looks and behaves. Changes persist to this browser.
          </p>
        </header>

        <SettingsSection
          title="Palette"
          description={
            <>
              Pick a visual identity for the app. Each preview renders in its own
              palette — what you see is what you get. Applies instantly.
            </>
          }
        >
          <ThemePicker />
        </SettingsSection>

        {/* Placeholder sections — ready when you are */}
        <SettingsSection
          title="Account"
          description="Sign-in, token scopes, and data sync. Coming soon."
        >
          <ComingSoon>
            Signed in as{" "}
            <span className="font-mono text-[var(--color-fg)]">{me?.login ?? "…"}</span>. Sign-out
            lives in the header menu; deeper controls arrive with M5.
          </ComingSoon>
        </SettingsSection>

        <SettingsSection
          title="About"
          description="GitHut is a focused, opinionated client for GitHub."
        >
          <ComingSoon>
            Version, build, and credits surface here once we wire the version stamp.
          </ComingSoon>
        </SettingsSection>
      </Container>
    </AppShell>
  );
}

// ─── Section primitive ─────────────────────────────────────────────────────

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-12 border-t border-[var(--color-border)] pt-8">
      <div className="mb-6 flex flex-col gap-1">
        <h2 className="font-mono text-[11px] font-medium uppercase tracking-widest text-[var(--color-fg-muted)]">
          {title}
        </h2>
        {description ? (
          <p className="max-w-2xl font-sans text-sm text-[var(--color-fg-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function ComingSoon({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] px-4 py-5 font-sans text-sm italic text-[var(--color-fg-faint)]">
      {children}
    </div>
  );
}
