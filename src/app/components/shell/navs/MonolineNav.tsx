import { Link } from "@tanstack/react-router";
import { UserMenu } from "@/app/components/shell/UserMenu";
import { Container } from "@/app/components/ui/Container";
import { useMe } from "@/app/hooks/useMe";
import { logout, manageGitHubAccess } from "@/app/lib/auth";
import { cn } from "@/app/lib/cn";
import { useCommandPalette } from "@/app/stores/commandPalette";
import { type Tab, useTabsStore } from "@/app/stores/tabs";
import type { NavProps } from "./types";

/**
 * Monoline — one ultra-thin row, aggressive minimalism for maximum content.
 *
 *   H_   ● ○ ○ ○              ⌘K     @login
 *
 * The wordmark compresses to `H_`. Tabs become a row of indicator dots —
 * filled for active, outline for inactive, hover reveals the label as a
 * tooltip strip floating below. Palette is a tiny chord glyph; avatar is
 * 20px. Total height: h-8 (32px). Designed for power users who want the
 * content to dominate and never think about chrome.
 */
export function MonolineNav({ bordered }: NavProps) {
  const { data: me } = useMe();
  const { open: openPalette } = useCommandPalette();
  const tabs = useTabsStore((s) => s.tabs);
  const activeTabId = useTabsStore((s) => s.activeTabId);
  const focusTab = useTabsStore((s) => s.focusTab);
  const closeTab = useTabsStore((s) => s.closeTab);

  return (
    <header
      className={cn(
        "h-8 bg-background",
        bordered && "border-b border-border",
      )}
    >
      <Container className="flex h-full items-center gap-3">
        {/* Monogram — the brand distilled */}
        <Link
          to="/"
          aria-label="Home"
          className="group inline-flex shrink-0 items-baseline gap-0 font-mono text-code font-semibold leading-none text-foreground"
        >
          H
          <span
            aria-hidden
            className="text-(--color-accent) transition-opacity duration-150 group-hover:opacity-60"
          >
            _
          </span>
        </Link>

        <span
          aria-hidden
          className="h-3 w-px shrink-0 bg-(--color-border-strong)"
        />

        {/* Dot indicators for tabs — cleanest possible tab representation */}
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto scrollbar-none">
          {tabs.length === 0 ? (
            <span className="font-mono text-micro italic text-(--color-fg-faint)">
              no active tabs
            </span>
          ) : (
            tabs.map((tab) => (
              <DotTab
                key={tab.id}
                tab={tab}
                active={tab.id === activeTabId}
                onFocus={() => focusTab(tab.id)}
                onClose={() => closeTab(tab.id)}
              />
            ))
          )}
        </div>

        {/* Right cluster — ultra-compact */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={openPalette}
            aria-label="Open command palette"
            title="Open command palette"
            className={cn(
              "font-mono text-micro text-muted-foreground transition-colors",
              "hover:text-foreground focus-visible:outline-none focus-visible:text-foreground",
            )}
          >
            ⌘K
          </button>
          {me && (
            <UserMenu
              login={me.login}
              avatarUrl={me.avatar_url}
              onSignOut={logout}
              onReAuth={manageGitHubAccess}
              variant="compact"
            />
          )}
        </div>
      </Container>
    </header>
  );
}

function DotTab({
  tab,
  active,
  onFocus,
  onClose,
}: {
  tab: Tab;
  active: boolean;
  onFocus: () => void;
  onClose: () => void;
}) {
  return (
    <div className="group relative flex items-center">
      <button
        type="button"
        onClick={onFocus}
        onMouseDown={(e) => e.button === 1 && (e.preventDefault(), onClose())}
        aria-label={`Switch to ${tab.label}`}
        title={tab.label}
        className={cn(
          "relative flex size-4 items-center justify-center rounded-full",
          "transition-all duration-150",
          "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--color-focus)",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "block rounded-full transition-all",
            active
              ? "size-2 bg-(--color-accent)"
              : "size-1.5 border border-(--color-border-strong) bg-transparent group-hover:bg-(--color-fg-faint) group-hover:border-(--color-fg-faint)",
          )}
        />
      </button>

      {/* Hover label — floating tooltip underneath */}
      <span
        className={cn(
          "pointer-events-none absolute left-1/2 top-full z-10 mt-1 -translate-x-1/2",
          "whitespace-nowrap rounded-sm border border-border bg-(--color-bg-subtle)",
          "px-1.5 py-0.5 font-mono text-micro leading-none text-foreground",
          "shadow-sm opacity-0 transition-opacity duration-100",
          "group-hover:opacity-100",
        )}
      >
        {tab.label}
      </span>
    </div>
  );
}
