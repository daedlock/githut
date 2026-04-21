import { Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { UserMenu } from "@/app/components/shell/UserMenu";
import { useMe } from "@/app/hooks/useMe";
import { logout, manageGitHubAccess } from "@/app/lib/auth";
import { cn } from "@/app/lib/cn";
import { useCommandPalette } from "@/app/stores/commandPalette";
import { type Tab, useTabsStore } from "@/app/stores/tabs";
import type { NavProps } from "./types";

/**
 * Heads-Up — a floating rounded island that hovers above content.
 *
 * Not edge-to-edge; centered horizontally at the top, max-width ~920px.
 * Backdrop-blur lets the page peek through; a soft ring of shadow + a
 * 1px border give the island physical dimension. Content underneath
 * can scroll past (the nav sits in `sticky top-2` with a subtle glass
 * effect).
 *
 * Feels like Dynamic Island / macOS notch / a floating dock.
 */
export function HeadsUpNav({ bordered }: NavProps) {
  const { data: me } = useMe();
  const { open: openPalette } = useCommandPalette();
  const tabs = useTabsStore((s) => s.tabs);
  const activeTabId = useTabsStore((s) => s.activeTabId);
  const focusTab = useTabsStore((s) => s.focusTab);
  const closeTab = useTabsStore((s) => s.closeTab);

  return (
    // Outer wrapper reserves vertical space so content sits below the island
    <div
      className={cn(
        "sticky top-0 z-30 flex w-full justify-center pt-3 pb-3",
        // Very subtle bottom-mask so content scrolling behind stays readable
        "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-full",
        "before:bg-gradient-to-b before:from-background/80 before:to-transparent",
        bordered && "border-b border-border/50",
      )}
    >
      <nav
        aria-label="Primary"
        className={cn(
          "relative flex h-11 w-[min(920px,calc(100vw-1.5rem))] items-center gap-2",
          "rounded-full border border-border/80 bg-(--color-bg-subtle)/80 backdrop-blur-xl",
          "pl-3 pr-1.5",
          "shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_8px_24px_-8px_rgba(0,0,0,0.25),0_2px_6px_-2px_rgba(0,0,0,0.15)]",
        )}
      >
        {/* Brand nub */}
        <Link
          to="/"
          aria-label="Home"
          className={cn(
            "group relative flex size-8 items-center justify-center rounded-full",
            "bg-background font-mono text-body font-semibold leading-none tracking-tight text-foreground",
            "border border-border shadow-sm transition-all",
            "hover:border-(--color-accent)/40",
          )}
          title="GitHut"
        >
          H
          <span
            aria-hidden
            className="text-(--color-accent) transition-opacity duration-150 group-hover:opacity-60"
          >
            _
          </span>
        </Link>

        {/* Tab cluster — middle, floating chips */}
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1 scrollbar-none">
          {tabs.length === 0 ? (
            <span className="font-mono text-micro italic text-(--color-fg-faint)">
              hovering in standby
            </span>
          ) : (
            tabs.map((tab) => (
              <HeadsUpTab
                key={tab.id}
                tab={tab}
                active={tab.id === activeTabId}
                onFocus={() => focusTab(tab.id)}
                onClose={() => closeTab(tab.id)}
              />
            ))
          )}
        </div>

        {/* Search pill — inline, rounded to match the island */}
        <button
          type="button"
          onClick={openPalette}
          aria-label="Open command palette"
          className={cn(
            "group flex h-7 items-center gap-1.5 rounded-full px-2.5",
            "bg-background/70 border border-border text-muted-foreground",
            "transition-all hover:bg-background hover:border-(--color-accent)/40 hover:text-foreground",
            "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--color-focus)",
          )}
        >
          <Search className="size-3.5" />
          <kbd className="rounded border border-border bg-(--color-bg-subtle) px-1 py-px font-mono text-micro leading-none">
            ⌘K
          </kbd>
        </button>

        {/* User */}
        {me && (
          <div className="pl-0.5">
            <UserMenu
              login={me.login}
              avatarUrl={me.avatar_url}
              onSignOut={logout}
              onReAuth={manageGitHubAccess}
              variant="compact"
            />
          </div>
        )}
      </nav>
    </div>
  );
}

function HeadsUpTab({
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
    <button
      type="button"
      onClick={onFocus}
      onMouseDown={(e) => e.button === 1 && (e.preventDefault(), onClose())}
      className={cn(
        "group flex max-w-[160px] shrink-0 items-center gap-1.5 rounded-full",
        "px-3 py-1 font-mono text-micro transition-all",
        "border",
        active
          ? "border-(--color-accent)/50 bg-background text-foreground shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-accent)_15%,transparent)]"
          : "border-transparent text-muted-foreground hover:border-border hover:bg-background/60 hover:text-foreground",
      )}
      title={tab.label}
    >
      <span className="truncate">{tab.label}</span>
      <span
        role="button"
        tabIndex={-1}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label={`Close ${tab.label}`}
        className={cn(
          "shrink-0 text-(--color-fg-faint)",
          "opacity-0 transition-opacity group-hover:opacity-100",
          "hover:text-(--color-danger)",
          active && "opacity-50",
        )}
      >
        ×
      </span>
    </button>
  );
}
