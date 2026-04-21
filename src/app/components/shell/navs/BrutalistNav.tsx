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
 * Brutalist — loud, editorial, unapologetic.
 *
 *   ╔═══════════════════════════════════════════════════════════╗
 *   ║ GITHUT_    ┃ ISSUE → MAIN/API → 42 ┃  [search]   ┃ @ ░░░ ║
 *   ╚═══════════════════════════════════════════════════════════╝
 *
 * Thick 2px border box. Display-sized monospace wordmark in ALL CAPS. A
 * hatching/stripe pattern fills dead space. Tabs read as METAL tags with
 * thick borders rather than soft pills. Visual volume turned up; not for
 * the faint of heart but unforgettable when you land on it.
 */
export function BrutalistNav({ bordered }: NavProps) {
  const { data: me } = useMe();
  const { open: openPalette } = useCommandPalette();
  const tabs = useTabsStore((s) => s.tabs);
  const activeTabId = useTabsStore((s) => s.activeTabId);
  const focusTab = useTabsStore((s) => s.focusTab);
  const closeTab = useTabsStore((s) => s.closeTab);

  return (
    <header
      className={cn(
        "relative flex h-16 w-full items-stretch bg-background",
        // Chunky bottom bar, always present — the brutalist signature
        "border-b-[3px] border-foreground",
        bordered && "",
      )}
    >
      {/* Wordmark — display-sized, ALL CAPS */}
      <Link
        to="/"
        aria-label="Home"
        className={cn(
          "group relative flex shrink-0 items-center bg-foreground px-5",
          "text-background transition-all",
          "before:pointer-events-none before:absolute before:inset-0",
          "before:[background-image:repeating-linear-gradient(135deg,transparent,transparent_6px,color-mix(in_oklab,var(--color-background)_15%,transparent)_6px,color-mix(in_oklab,var(--color-background)_15%,transparent)_7px)]",
          "before:opacity-0 group-hover:before:opacity-100 before:transition-opacity",
        )}
      >
        <span className="relative font-mono text-title font-bold uppercase leading-none tracking-[-0.03em]">
          GITHUT
          <span className="text-(--color-accent)">_</span>
        </span>
      </Link>

      {/* Session trail — loud uppercase breadcrumb of tabs */}
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto border-r-[3px] border-foreground px-5 scrollbar-none">
        {tabs.length === 0 ? (
          <span className="font-mono text-caption uppercase tracking-[0.25em] text-(--color-fg-faint)">
            — no session —
          </span>
        ) : (
          tabs.map((tab, i) => (
            <BrutalistTab
              key={tab.id}
              tab={tab}
              active={tab.id === activeTabId}
              showSep={i > 0}
              onFocus={() => focusTab(tab.id)}
              onClose={() => closeTab(tab.id)}
            />
          ))
        )}
      </div>

      {/* Actions — thick bordered buttons */}
      <div className="flex shrink-0 items-center gap-0">
        <button
          type="button"
          onClick={openPalette}
          aria-label="Open command palette"
          className={cn(
            "group flex h-full items-center gap-2 border-r-[3px] border-foreground px-5",
            "font-mono text-caption uppercase tracking-widest",
            "text-muted-foreground transition-colors",
            "hover:bg-foreground hover:text-background",
            "focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-(--color-focus)",
          )}
        >
          <Search className="size-3.5" />
          <span>Search</span>
          <kbd className="rounded-none border-[2px] border-current bg-transparent px-1 py-px font-mono text-micro leading-none">
            ⌘K
          </kbd>
        </button>
        <div className="flex h-full items-center px-4">
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
      </div>
    </header>
  );
}

function BrutalistTab({
  tab,
  active,
  showSep,
  onFocus,
  onClose,
}: {
  tab: Tab;
  active: boolean;
  showSep: boolean;
  onFocus: () => void;
  onClose: () => void;
}) {
  return (
    <span className="flex shrink-0 items-center gap-2">
      {showSep && (
        <span
          aria-hidden
          className="font-mono text-body font-bold text-(--color-fg-faint)"
        >
          /
        </span>
      )}
      <button
        type="button"
        onClick={onFocus}
        onMouseDown={(e) => e.button === 1 && (e.preventDefault(), onClose())}
        className={cn(
          "group/tab flex max-w-[220px] items-center gap-1.5 px-2 py-1",
          "border-[2px] font-mono text-caption uppercase tracking-wider transition-all",
          active
            ? [
                "border-(--color-accent) bg-(--color-accent) text-(--color-accent-fg)",
                "shadow-[3px_3px_0_0_var(--color-foreground)]",
              ]
            : [
                "border-foreground bg-background text-foreground",
                "hover:bg-foreground hover:text-background",
                "hover:shadow-[3px_3px_0_0_var(--color-accent)]",
              ],
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
            "text-current opacity-0 transition-opacity group-hover/tab:opacity-100",
            active && "opacity-70",
          )}
        >
          ✕
        </span>
      </button>
    </span>
  );
}
