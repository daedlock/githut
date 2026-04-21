import { Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { TabBar } from "@/app/components/shell/TabBar";
import { UserMenu } from "@/app/components/shell/UserMenu";
import { Container } from "@/app/components/ui/Container";
import { useMe } from "@/app/hooks/useMe";
import { logout, manageGitHubAccess } from "@/app/lib/auth";
import { cn } from "@/app/lib/cn";
import { useCommandPalette } from "@/app/stores/commandPalette";
import { useSettingsStore } from "@/app/stores/settings";
import { useTabsStore } from "@/app/stores/tabs";
import type { NavProps } from "./types";

/**
 * Inline — the canonical GitHut nav. Everything on a single h-9 row:
 *
 *   │ GitHut_   [ tabs flow here as they open ]      [search]  [avatar] │
 *
 * Tabs live inline with the main chrome (no second row), saving vertical
 * space. The tab strip takes the middle `flex-1` so workspace growth
 * never pushes other controls around.
 *
 * `wide=true` removes the Container constraint so the nav stretches
 * edge-to-edge — useful on wide monitors where the container feels
 * cramped. `wide=false` keeps everything aligned with the content below.
 */
export function InlineNav({
  bordered = false,
  wide = false,
  className,
}: NavProps & { wide?: boolean; className?: string }) {
  const { data: me } = useMe();
  const { open: openPalette } = useCommandPalette();
  const tabsEnabled = useSettingsStore((s) => s.tabsEnabled);
  const tabCount = useTabsStore((s) => s.tabs.length);
  const hasWorkspaceTabs = tabsEnabled && tabCount > 0;

  const row = (
    <>
      <Link
        to="/"
        aria-label="Home"
        className="group inline-flex shrink-0 items-baseline gap-0 font-mono text-body font-medium tracking-tight text-foreground select-none"
      >
        GitHut
        <span
          aria-hidden
          className="text-primary transition-opacity duration-150 group-hover:opacity-60"
        >
          _
        </span>
      </Link>

      <div className="min-w-0 flex-1">
        <TabBar inline />
      </div>

      <div className="flex items-center gap-1.5">
        <PaletteTrigger onClick={openPalette} />
        {me ? (
          <UserMenu
            login={me.login}
            avatarUrl={me.avatar_url}
            onSignOut={logout}
            onReAuth={manageGitHubAccess}
            variant="compact"
          />
        ) : null}
      </div>
    </>
  );

  return (
    <header
      className={cn(
        "h-9 bg-background",
        (bordered || hasWorkspaceTabs) && "border-b border-border",
        className,
      )}
    >
      {wide ? (
        <div className="flex h-full items-center gap-2 px-4 sm:px-6">{row}</div>
      ) : (
        <Container className="flex h-full items-center gap-2">{row}</Container>
      )}
    </header>
  );
}

function PaletteTrigger({ onClick }: { onClick: () => void }) {
  const mac = isMac();
  const chord = mac ? "⌘K" : "Ctrl K";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open command palette"
      title="Open command palette"
      className={cn(
        "group inline-flex h-7 items-center gap-2 rounded-md",
        "border border-border bg-(--color-bg-subtle)",
        "pl-2 pr-2 text-muted-foreground outline-none",
        "transition-colors hover:bg-(--color-bg-sunken) hover:text-foreground",
        "focus-visible:ring-1 focus-visible:ring-(--color-focus)",
      )}
    >
      <Search className="size-3.5 shrink-0" />
      <span className="text-caption">Search</span>
      <kbd className="rounded border border-border bg-background px-1 py-px font-mono text-micro leading-none text-muted-foreground group-hover:border-border-strong">
        {chord}
      </kbd>
    </button>
  );
}

function isMac() {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}
