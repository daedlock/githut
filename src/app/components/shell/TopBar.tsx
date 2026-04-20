import { Link } from "@tanstack/react-router";
import { TabBar } from "@/app/components/shell/TabBar";
import { UserMenu } from "@/app/components/shell/UserMenu";
import { Container } from "@/app/components/ui/Container";
import { useMe } from "@/app/hooks/useMe";
import { logout } from "@/app/lib/auth";
import { cn } from "@/app/lib/cn";
import { useCommandPalette } from "@/app/stores/commandPalette";
import { useSettingsStore } from "@/app/stores/settings";
import { useTabsStore } from "@/app/stores/tabs";

export type TopBarProps = {
  /**
   * Draw a hairline below the entire header assembly (top bar + workspace bar).
   * Turn OFF when a tab row (e.g. RepoTabs) follows immediately below.
   */
  bordered?: boolean;
  className?: string;
};

/**
 * Single-row top bar per §3.
 *
 *   wordmark · workspace tabs · right actions
 *
 * TopBar is self-contained — it fetches the current user for the avatar and
 * opens the palette imperatively. Routes stay one-liners:
 *   <AppShell header={<TopBar />}>…</AppShell>
 */
export function TopBar({ bordered = false, className }: TopBarProps) {
  const { data: me } = useMe();
  const { open: openPalette } = useCommandPalette();
  const tabsEnabled = useSettingsStore((s) => s.tabsEnabled);
  const tabCount = useTabsStore((s) => s.tabs.length);
  const hasWorkspaceTabs = tabsEnabled && tabCount > 0;

  return (
    <header className={cn((bordered || hasWorkspaceTabs) && "border-b border-border", className)}>
      <Container className="flex items-center gap-3 py-2.5">
        {/* Left cluster — brand */}
        <Link
          to="/"
          className="group inline-flex items-baseline gap-0 font-mono text-body font-medium tracking-tight text-foreground select-none"
          aria-label="Home"
        >
          GitHut
          <span
            aria-hidden
            className="text-primary transition-opacity duration-150 group-hover:opacity-60"
          >
            _
          </span>
        </Link>

        {/* Merged workspace tab strip */}
        <div className="min-w-0 flex-1">
          <TabBar inline />
        </div>

        {/* Right cluster — simplified actions */}
        <div className="flex items-center gap-1">
          <PaletteTrigger onClick={openPalette} />

          {me ? (
            <UserMenu
              login={me.login}
              avatarUrl={me.avatar_url}
              onSignOut={logout}
              variant="compact"
            />
          ) : null}
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
        "inline-flex h-7 items-center gap-1 rounded-md px-2",
        "font-mono text-caption leading-none text-muted-foreground",
        "outline-none transition-colors",
        "hover:bg-muted hover:text-foreground",
        "focus-visible:bg-muted focus-visible:text-foreground",
        "focus-visible:ring-1 focus-visible:ring-foreground/15",
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
