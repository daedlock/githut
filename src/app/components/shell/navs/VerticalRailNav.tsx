import { Link } from "@tanstack/react-router";
import { Command, Search } from "lucide-react";
import { UserMenu } from "@/app/components/shell/UserMenu";
import { useMe } from "@/app/hooks/useMe";
import { logout, manageGitHubAccess } from "@/app/lib/auth";
import { cn } from "@/app/lib/cn";
import { useCommandPalette } from "@/app/stores/commandPalette";
import { type Tab, useTabsStore } from "@/app/stores/tabs";
import type { NavProps } from "./types";

/**
 * Vertical Rail — a fundamental layout flip. Sidebar on the left; main
 * content fills the remaining viewport. 48px wide, fixed width.
 *
 *   ┌──┐
 *   │H_│  ← monogram
 *   │──│
 *   │⌘ │  ← palette trigger
 *   │──│
 *   │▶ │  ← open tabs as vertical indicators (top = most recent)
 *   │▷ │     (filled = active, outlined = inactive)
 *   │▷ │
 *   │  │
 *   │@ │  ← user avatar, pinned bottom
 *   └──┘
 *
 * Requires AppShell to render `flex-row` when this variant is active so
 * the rail sits beside content instead of above it. Maximum vertical
 * space for code/diff views — no wasted height to nav chrome.
 */
export function VerticalRailNav({ bordered }: NavProps) {
  const { data: me } = useMe();
  const { open: openPalette } = useCommandPalette();
  const tabs = useTabsStore((s) => s.tabs);
  const activeTabId = useTabsStore((s) => s.activeTabId);
  const focusTab = useTabsStore((s) => s.focusTab);
  const closeTab = useTabsStore((s) => s.closeTab);

  return (
    <aside
      className={cn(
        "sticky top-0 flex h-screen w-12 shrink-0 flex-col items-center",
        "bg-(--color-bg-subtle) py-2",
        bordered && "border-r border-border",
      )}
    >
      {/* Monogram */}
      <Link
        to="/"
        aria-label="Home"
        className="group mb-2 flex size-8 items-center justify-center"
      >
        <span className="font-mono text-body font-semibold leading-none tracking-tight text-foreground">
          H
          <span
            aria-hidden
            className="text-(--color-accent) transition-opacity duration-150 group-hover:opacity-60"
          >
            _
          </span>
        </span>
      </Link>

      <span aria-hidden className="my-1 h-px w-6 bg-border" />

      {/* Palette trigger */}
      <button
        type="button"
        onClick={openPalette}
        aria-label="Open command palette"
        title="Open command palette (⌘K)"
        className={cn(
          "group relative flex size-8 items-center justify-center rounded-md",
          "text-muted-foreground transition-colors",
          "hover:bg-(--color-bg-sunken) hover:text-foreground",
          "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--color-focus)",
        )}
      >
        <Search className="size-4" />
        <span
          className={cn(
            "pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-sm",
            "border border-border bg-(--color-bg-subtle) px-2 py-0.5",
            "font-mono text-micro leading-none text-foreground shadow-sm",
            "opacity-0 transition-opacity group-hover:opacity-100",
          )}
        >
          <Command className="mr-0.5 inline size-2.5" />K
        </span>
      </button>

      <span aria-hidden className="my-1.5 h-px w-6 bg-border" />

      {/* Tab column — vertical "dots" with hover-revealed labels */}
      <nav
        aria-label="Open workspaces"
        className="flex flex-1 flex-col items-center gap-1 overflow-y-auto py-1 scrollbar-none"
      >
        {tabs.length === 0 ? (
          <span className="rotate-180 font-mono text-micro uppercase tracking-widest text-(--color-fg-faint)" style={{ writingMode: "vertical-rl" }}>
            empty
          </span>
        ) : (
          tabs.map((tab) => (
            <RailTab
              key={tab.id}
              tab={tab}
              active={tab.id === activeTabId}
              onFocus={() => focusTab(tab.id)}
              onClose={() => closeTab(tab.id)}
            />
          ))
        )}
      </nav>

      <span aria-hidden className="mb-2 mt-1 h-px w-6 bg-border" />

      {/* User — pinned bottom */}
      {me && (
        <div className="mb-1">
          <UserMenu
            login={me.login}
            avatarUrl={me.avatar_url}
            onSignOut={logout}
            onReAuth={manageGitHubAccess}
            variant="compact"
          />
        </div>
      )}
    </aside>
  );
}

function RailTab({
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
          "relative flex size-8 items-center justify-center rounded-md",
          "transition-all duration-150",
          active ? "bg-background shadow-sm" : "hover:bg-(--color-bg-sunken)",
          "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--color-focus)",
        )}
      >
        {/* Left accent marker for active */}
        {active && (
          <span
            aria-hidden
            className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-(--color-accent)"
          />
        )}
        <span
          className={cn(
            "truncate font-mono text-[10px] font-medium leading-none",
            active ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {tab.label.slice(0, 2).toLowerCase()}
        </span>
      </button>

      {/* Hover label — floats to the right, styled like a terminal toast */}
      <span
        className={cn(
          "pointer-events-none absolute left-full z-40 ml-2 whitespace-nowrap",
          "rounded-sm border border-border bg-(--color-bg-subtle) px-2 py-1",
          "font-mono text-micro leading-none text-foreground shadow-sm",
          "opacity-0 transition-opacity duration-100",
          "group-hover:opacity-100",
        )}
      >
        {tab.label}
      </span>
    </div>
  );
}
