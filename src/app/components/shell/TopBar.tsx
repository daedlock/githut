import { Link, useMatches } from "@tanstack/react-router";
import { InboxPill } from "@/app/components/shell/InboxPill";
import { UserMenu } from "@/app/components/shell/UserMenu";
import { WorkspaceSwitcher } from "@/app/components/shell/WorkspaceSwitcher";
import { Container } from "@/app/components/ui/Container";
import { useMe } from "@/app/hooks/useMe";
import { logout } from "@/app/lib/auth";
import { cn } from "@/app/lib/cn";
import { useCommandPalette } from "@/app/stores/commandPalette";

export type TopBarProps = {
  /**
   * Draw a hairline below the top bar. Turn OFF when a tab row follows so
   * a single border closes the header assembly (no striped double lines).
   */
  bordered?: boolean;
  className?: string;
};

/**
 * Single-row top bar per §3.
 *
 *   wordmark · workspace switcher · breadcrumb    inbox · ⌘K · user menu
 *
 * TopBar is self-contained — it reads the route to decide whether to render
 * a breadcrumb, fetches the current user for the avatar, and opens the
 * palette imperatively. Routes stay one-liners:
 *   <AppShell header={<TopBar />}>…</AppShell>
 *
 * Owner/repo detection walks the active route matches and pulls params off
 * the match that actually declares them — this is more robust than typing a
 * `from:` string on `useParams` (which would tie TopBar to one route).
 */
export function TopBar({ bordered = false, className }: TopBarProps) {
  const { data: me } = useMe();
  const { open: openPalette } = useCommandPalette();
  const { owner, repo } = useOwnerRepo();

  return (
    <header className={cn(bordered && "border-b border-[var(--color-border)]", className)}>
      <Container className="flex items-center gap-3 py-3">
        {/* Left cluster — brand, workspace, breadcrumb */}
        <Link
          to="/"
          className="group inline-flex items-baseline gap-0 font-mono text-body font-medium tracking-tight text-[var(--color-fg)] select-none"
          aria-label="Home"
        >
          GitHut
          <span
            aria-hidden
            className="text-[var(--color-accent)] transition-opacity duration-150 group-hover:opacity-60"
          >
            _
          </span>
        </Link>

        <WorkspaceSwitcher />

        {owner && repo ? (
          <nav
            aria-label="Repository"
            className="flex min-w-0 items-baseline gap-1.5 text-ui truncate"
          >
            {/* Sans per §6 — breadcrumb reads as UI label, not code.
                Separator uses fg-faint for a quiet divider. */}
            <span className="text-[var(--color-fg-faint)]" aria-hidden>
              ⋮
            </span>
            <span className="truncate text-[var(--color-fg-muted)]">{owner}</span>
            <span className="text-[var(--color-fg-faint)]" aria-hidden>
              /
            </span>
            <span className="truncate font-medium text-[var(--color-fg)]">{repo}</span>
          </nav>
        ) : null}

        {/* Right cluster — inbox, palette trigger, user menu */}
        <div className="ml-auto flex items-center gap-1">
          <InboxPill count={0} />

          <PaletteTrigger onClick={openPalette} />

          {me ? <UserMenu login={me.login} avatarUrl={me.avatar_url} onSignOut={logout} /> : null}
        </div>
      </Container>
    </header>
  );
}

// ─── Palette trigger ───────────────────────────────────────────────────────

function PaletteTrigger({ onClick }: { onClick: () => void }) {
  const chord = isMac() ? "⌘K" : "Ctrl K";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open command palette"
      title="Open command palette"
      className={cn(
        "inline-flex items-center gap-1 rounded-[var(--radius-sm)] px-2 py-1",
        "font-mono text-caption text-[var(--color-fg-muted)]",
        "transition-colors hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg)]",
      )}
    >
      <span>{chord}</span>
    </button>
  );
}

function isMac() {
  if (typeof navigator === "undefined") return false;
  // navigator.platform is the widely-compatible signal; navigator.userAgentData
  // exists but isn't uniformly available yet and the fallback covers all modern
  // browsers accurately enough for a visual hint.
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

// ─── Route params ──────────────────────────────────────────────────────────

/**
 * Reads `owner`/`repo` from the active route match chain. Walks every active
 * match and picks up whichever one carries the params — lets us stay decoupled
 * from any specific route file path.
 */
function useOwnerRepo(): { owner?: string; repo?: string } {
  const matches = useMatches();
  for (const m of matches) {
    const p = m.params as Record<string, string | undefined>;
    if (p.owner && p.repo) return { owner: p.owner, repo: p.repo };
  }
  return {};
}
