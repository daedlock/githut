import { Link } from "@tanstack/react-router";
import { ChevronRight, Search } from "lucide-react";
import { UserMenu } from "@/app/components/shell/UserMenu";
import { useMe } from "@/app/hooks/useMe";
import { logout, manageGitHubAccess } from "@/app/lib/auth";
import { cn } from "@/app/lib/cn";
import { useCommandPalette } from "@/app/stores/commandPalette";
import { type Tab, useTabsStore } from "@/app/stores/tabs";
import type { NavProps } from "./types";

/**
 * Deck — full-bleed panoramic control strip. Four segments divided by
 * vertical rules; each segment owns one concern.
 *
 *   │ H_ │ 🔍 search        ⌘K │ ▸ owner/repo ▸ issues #42 │ [a] │
 *    |    |                    |                            |
 *    │ brand │ command         │ session                    │ user │
 *
 * Edge-to-edge — no Container — so on wide monitors it reads like a
 * cockpit/mixing console. On narrow screens the tab strip and search
 * compress gracefully. Mono throughout.
 */
export function DeckNav({ bordered }: NavProps) {
  const { data: me } = useMe();
  const { open: openPalette } = useCommandPalette();
  const tabs = useTabsStore((s) => s.tabs);
  const activeTabId = useTabsStore((s) => s.activeTabId);
  const focusTab = useTabsStore((s) => s.focusTab);
  const closeTab = useTabsStore((s) => s.closeTab);

  return (
    <header
      className={cn(
        "flex h-11 w-full items-stretch bg-(--color-bg-subtle)",
        bordered && "border-b border-border",
      )}
    >
      {/* Segment 1 — Brand plaque */}
      <div className="flex items-center border-r border-border px-5">
        <Link
          to="/"
          aria-label="Home"
          className="group font-mono text-body font-semibold tracking-tight text-foreground"
        >
          GitHut
          <span
            aria-hidden
            className="text-(--color-accent) transition-opacity duration-150 group-hover:opacity-60"
          >
            _
          </span>
        </Link>
      </div>

      {/* Segment 2 — Command bar (search, takes flex-[2]) */}
      <div className="flex min-w-0 flex-[2] items-center border-r border-border px-3">
        <button
          type="button"
          onClick={openPalette}
          aria-label="Open command palette"
          className={cn(
            "group flex h-7 w-full items-center gap-2 rounded-sm",
            "bg-background border border-border pl-2 pr-1.5",
            "text-muted-foreground transition-colors",
            "hover:border-(--color-accent)/40 hover:text-foreground",
            "focus-visible:outline-2 focus-visible:outline-(--color-focus)",
          )}
        >
          <Search className="size-3.5 shrink-0" />
          <span className="flex-1 text-left font-sans text-caption">Search or jump…</span>
          <kbd className="rounded border border-border bg-(--color-bg-subtle) px-1 py-px font-mono text-micro leading-none">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Segment 3 — Session trail (tabs as breadcrumb) */}
      <div className="flex min-w-0 flex-[3] items-center gap-0.5 overflow-x-auto border-r border-border px-3 scrollbar-none">
        {tabs.length === 0 ? (
          <span className="font-mono text-micro italic text-(--color-fg-faint)">
            awaiting workspace
          </span>
        ) : (
          tabs.map((tab, i) => (
            <DeckTab
              key={tab.id}
              tab={tab}
              active={tab.id === activeTabId}
              showChevron={i > 0}
              onFocus={() => focusTab(tab.id)}
              onClose={() => closeTab(tab.id)}
            />
          ))
        )}
      </div>

      {/* Segment 4 — User plaque */}
      <div className="flex shrink-0 items-center px-4">
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
    </header>
  );
}

function DeckTab({
  tab,
  active,
  showChevron,
  onFocus,
  onClose,
}: {
  tab: Tab;
  active: boolean;
  showChevron: boolean;
  onFocus: () => void;
  onClose: () => void;
}) {
  return (
    <span className="flex shrink-0 items-center">
      {showChevron && (
        <ChevronRight
          className="mx-0.5 size-3 shrink-0 text-(--color-fg-faint)"
          aria-hidden
        />
      )}
      <button
        type="button"
        onClick={onFocus}
        onMouseDown={(e) => e.button === 1 && (e.preventDefault(), onClose())}
        className={cn(
          "group/tab flex max-w-[200px] items-center gap-1 rounded-sm px-1.5 py-0.5",
          "font-mono text-caption transition-colors",
          active
            ? "bg-background text-foreground shadow-[0_-1.5px_0_var(--color-accent)_inset]"
            : "text-muted-foreground hover:bg-background hover:text-foreground",
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
            "text-(--color-fg-faint) opacity-0 transition-opacity group-hover/tab:opacity-100",
            "hover:text-(--color-danger)",
            active && "opacity-60",
          )}
        >
          ×
        </span>
      </button>
    </span>
  );
}
