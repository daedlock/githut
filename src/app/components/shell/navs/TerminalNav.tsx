import { Link } from "@tanstack/react-router";
import { ChevronRight, Terminal } from "lucide-react";
import { UserMenu } from "@/app/components/shell/UserMenu";
import { Container } from "@/app/components/ui/Container";
import { useMe } from "@/app/hooks/useMe";
import { logout, manageGitHubAccess } from "@/app/lib/auth";
import { cn } from "@/app/lib/cn";
import { useCommandPalette } from "@/app/stores/commandPalette";
import { type Tab, useTabsStore } from "@/app/stores/tabs";
import type { NavProps } from "./types";

/**
 * Terminal — a single row styled as a shell prompt.
 *
 *   $ githut:~/open ▸ [ owner/repo ] [ issues #42 ]+     ⟢ ⌘K   [a]
 *
 * Tabs read as filename chips (`main.ts` style) separated by ▸. The active
 * tab gets an inline blinking caret. Palette trigger reduces to a minimal
 * `⌘K` chord glyph — the prompt aesthetic discourages visual noise.
 */
export function TerminalNav({ bordered }: NavProps) {
  const { data: me } = useMe();
  const { open: openPalette } = useCommandPalette();
  const tabs = useTabsStore((s) => s.tabs);
  const activeTabId = useTabsStore((s) => s.activeTabId);
  const focusTab = useTabsStore((s) => s.focusTab);
  const closeTab = useTabsStore((s) => s.closeTab);

  return (
    <header
      className={cn(
        "h-11 bg-background font-mono text-caption",
        bordered && "border-b border-border",
      )}
    >
      <Container className="flex h-full items-center gap-2">
        {/* Prompt glyph + wordmark as path */}
        <Link
          to="/"
          aria-label="Home"
          className="group flex shrink-0 items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          <Terminal className="size-3.5 text-(--color-accent)" aria-hidden />
          <span className="text-foreground">githut</span>
          <span className="text-(--color-fg-faint)">:</span>
          <span className="text-muted-foreground">~</span>
          <span className="text-(--color-accent)">$</span>
        </Link>

        {/* Tab pipeline */}
        <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto scrollbar-none">
          {tabs.map((tab, i) => (
            <PromptTab
              key={tab.id}
              tab={tab}
              active={tab.id === activeTabId}
              isLast={i === tabs.length - 1}
              onFocus={() => focusTab(tab.id)}
              onClose={() => closeTab(tab.id)}
            />
          ))}
          {tabs.length === 0 && (
            <span className="text-(--color-fg-faint) italic">nothing open</span>
          )}
        </div>

        {/* Right cluster — minimal glyph actions */}
        <div className="flex shrink-0 items-center gap-2 text-muted-foreground">
          <button
            type="button"
            onClick={openPalette}
            className={cn(
              "flex h-6 items-center gap-1.5 rounded-sm px-1.5",
              "transition-colors hover:bg-(--color-bg-sunken) hover:text-foreground",
              "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--color-focus)",
            )}
            aria-label="Open command palette"
            title="Open command palette"
          >
            <span className="text-(--color-accent)">⌘</span>
            <span>k</span>
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

function PromptTab({
  tab,
  active,
  isLast,
  onFocus,
  onClose,
}: {
  tab: Tab;
  active: boolean;
  isLast: boolean;
  onFocus: () => void;
  onClose: () => void;
}) {
  return (
    <span className="flex items-center">
      <button
        type="button"
        onClick={onFocus}
        onMouseDown={(e) => e.button === 1 && (e.preventDefault(), onClose())}
        className={cn(
          "group/tab relative flex max-w-[180px] items-center gap-1 rounded-sm px-1.5 py-0.5",
          "transition-colors",
          active
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
        title={tab.label}
      >
        <span className="truncate font-mono text-caption">
          {tab.label.replace(/^.+\//, "")}
        </span>
        {active && (
          <span
            aria-hidden
            className="ml-0.5 inline-block h-3 w-[2px] bg-(--color-accent) animate-[caret-blink_1.06s_steps(2)_infinite]"
          />
        )}
        <span
          role="button"
          tabIndex={-1}
          aria-label={`Close ${tab.label}`}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className={cn(
            "ml-0.5 text-(--color-fg-faint) opacity-0 transition-opacity",
            "hover:text-(--color-danger)",
            "group-hover/tab:opacity-100",
            active && "opacity-50",
          )}
        >
          ×
        </span>
      </button>
      {!isLast && (
        <ChevronRight className="size-3 shrink-0 text-(--color-fg-faint)" aria-hidden />
      )}
    </span>
  );
}
