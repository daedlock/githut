import { Link } from "@tanstack/react-router";
import { ArrowRight, Search } from "lucide-react";
import { UserMenu } from "@/app/components/shell/UserMenu";
import { Container } from "@/app/components/ui/Container";
import { useMe } from "@/app/hooks/useMe";
import { logout, manageGitHubAccess } from "@/app/lib/auth";
import { cn } from "@/app/lib/cn";
import { useCommandPalette } from "@/app/stores/commandPalette";
import { type Tab, useTabsStore } from "@/app/stores/tabs";
import type { NavProps } from "./types";

/**
 * Command Center — the search bar is the hero.
 *
 *   GitHut_              ┏━━━━━━━━━━━━━━━━━━━━━━━━┓              [a]
 *                        ┃ 🔍 Search or jump…  ⌘K ┃
 *                        ┗━━━━━━━━━━━━━━━━━━━━━━━━┛
 *                     [ owner/repo ×] [ owner/repo ×]
 *
 * Wordmark retreats to the corner. A large, inviting palette pill sits in
 * the center. Open tabs float below as rounded pills centered beneath the
 * search. Arc/Raycast DNA — the fastest way in is the most prominent UI.
 */
export function CommandCenterNav({ bordered }: NavProps) {
  const { data: me } = useMe();
  const { open: openPalette } = useCommandPalette();
  const tabs = useTabsStore((s) => s.tabs);
  const activeTabId = useTabsStore((s) => s.activeTabId);
  const focusTab = useTabsStore((s) => s.focusTab);
  const closeTab = useTabsStore((s) => s.closeTab);

  return (
    <header
      className={cn(
        "relative bg-background",
        "bg-[radial-gradient(ellipse_800px_120px_at_50%_0%,color-mix(in_oklab,var(--color-accent)_10%,transparent),transparent)]",
        bordered && "border-b border-border",
      )}
    >
      <Container className="flex flex-col gap-2 pt-2.5 pb-2">
        {/* Main row — wordmark · center search · avatar */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <Link
            to="/"
            aria-label="Home"
            className="group inline-flex w-fit items-baseline gap-0 font-mono text-body font-medium tracking-tight text-foreground"
          >
            GitHut
            <span
              aria-hidden
              className="text-(--color-accent) transition-opacity duration-150 group-hover:opacity-60"
            >
              _
            </span>
          </Link>

          {/* Center stage search pill */}
          <button
            type="button"
            onClick={openPalette}
            aria-label="Open command palette"
            className={cn(
              "group relative flex h-10 w-[min(480px,70vw)] items-center gap-3",
              "rounded-full border border-border bg-(--color-bg-subtle)",
              "pl-4 pr-3 text-muted-foreground transition-all",
              "shadow-[0_1px_0_rgba(0,0,0,0.03),0_4px_12px_-4px_rgba(0,0,0,0.1)]",
              "hover:border-(--color-accent) hover:bg-(--color-bg)",
              "hover:shadow-[0_1px_0_rgba(0,0,0,0.03),0_4px_20px_-4px_color-mix(in_oklab,var(--color-accent)_40%,transparent)]",
              "focus-visible:outline-none",
              "focus-visible:border-(--color-accent) focus-visible:ring-2 focus-visible:ring-(--color-accent)/30",
            )}
          >
            <Search className="size-4 shrink-0 transition-colors group-hover:text-(--color-accent)" />
            <span className="flex-1 text-left font-sans text-body">
              Search or jump to anything…
            </span>
            <kbd
              className={cn(
                "shrink-0 rounded border border-border bg-(--color-bg) px-1.5 py-0.5",
                "font-mono text-micro leading-none text-muted-foreground",
                "transition-colors group-hover:border-(--color-accent)/50 group-hover:text-foreground",
              )}
            >
              ⌘K
            </kbd>
            <ArrowRight
              aria-hidden
              className={cn(
                "size-3.5 shrink-0 text-(--color-fg-faint)",
                "-translate-x-1 opacity-0 transition-all",
                "group-hover:translate-x-0 group-hover:opacity-100 group-hover:text-(--color-accent)",
              )}
            />
          </button>

          <div className="flex justify-end">
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

        {/* Tab chip row — centered, floating */}
        {tabs.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-1">
            {tabs.map((tab) => (
              <ChipTab
                key={tab.id}
                tab={tab}
                active={tab.id === activeTabId}
                onFocus={() => focusTab(tab.id)}
                onClose={() => closeTab(tab.id)}
              />
            ))}
          </div>
        )}
      </Container>
    </header>
  );
}

function ChipTab({
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
        "group flex max-w-[200px] items-center gap-1.5 rounded-full",
        "px-2.5 py-1 font-mono text-micro transition-all",
        "border",
        active
          ? [
              "border-(--color-accent)/40 bg-(--color-accent)/10 text-foreground",
              "shadow-[0_1px_0_rgba(0,0,0,0.04),0_0_0_1px_color-mix(in_oklab,var(--color-accent)_20%,transparent)]",
            ]
          : [
              "border-border bg-(--color-bg-subtle) text-muted-foreground",
              "hover:border-border-strong hover:bg-(--color-bg-sunken) hover:text-foreground",
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
          "shrink-0 text-(--color-fg-faint)",
          "opacity-0 transition-opacity group-hover:opacity-100",
          "hover:text-(--color-danger)",
          active && "opacity-60",
        )}
      >
        ×
      </span>
    </button>
  );
}
