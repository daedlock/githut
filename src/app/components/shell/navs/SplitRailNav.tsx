import { Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { TabBar } from "@/app/components/shell/TabBar";
import { UserMenu } from "@/app/components/shell/UserMenu";
import { Container } from "@/app/components/ui/Container";
import { useMe } from "@/app/hooks/useMe";
import { logout, manageGitHubAccess } from "@/app/lib/auth";
import { cn } from "@/app/lib/cn";
import { useCommandPalette } from "@/app/stores/commandPalette";
import { useTabsStore } from "@/app/stores/tabs";
import type { NavProps } from "./types";

/**
 * Split Rail — two distinct horizontal rails stacked.
 *
 *   ┌────────────────────────────────────────────────────┐
 *   │ GitHut_        · 3 tabs open ·       ⌘K  [ava]    │  h-9
 *   ├────────────────────────────────────────────────────┤
 *   │ [owner/repo ×]  [owner/repo ×]  [owner/repo ×]    │  h-10
 *   └────────────────────────────────────────────────────┘
 *
 * Information hierarchy is physical — identity lives above the hairline,
 * the workspace ("what I'm doing right now") lives below. Reads like a
 * titlebar + tabbar from a native IDE. Taller total (h-19 = 76px) but
 * crystal clear on what each zone is for.
 */
export function SplitRailNav({ bordered }: NavProps) {
  const { data: me } = useMe();
  const { open: openPalette } = useCommandPalette();
  const tabCount = useTabsStore((s) => s.tabs.length);
  const hasTabs = tabCount > 0;

  return (
    <header
      className={cn(
        "flex flex-col bg-background",
        bordered && "border-b border-border",
      )}
    >
      {/* ── Identity rail ──────────────────────────────────────────── */}
      <div className="relative h-9 border-b border-border">
        <Container className="flex h-full items-center gap-3">
          <Link
            to="/"
            aria-label="Home"
            className="group inline-flex shrink-0 items-baseline gap-0 font-mono text-body font-medium tracking-tight text-foreground select-none"
          >
            GitHut
            <span
              aria-hidden
              className="text-(--color-accent) transition-opacity duration-150 group-hover:opacity-60"
            >
              _
            </span>
          </Link>

          {/* Session indicator — quiet, off-to-the-side */}
          <div className="flex flex-1 items-center">
            {hasTabs && (
              <span className="flex items-center gap-1.5 font-mono text-caption text-muted-foreground">
                <span
                  aria-hidden
                  className="inline-block size-1.5 rounded-full bg-(--color-success)"
                />
                <span className="tabular-nums">{tabCount}</span>
                <span>{tabCount === 1 ? "tab" : "tabs"} open</span>
              </span>
            )}
          </div>

          {/* Right cluster */}
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={openPalette}
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
              <kbd className="rounded border border-border bg-background px-1 py-px font-mono text-micro leading-none text-muted-foreground">
                ⌘K
              </kbd>
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
      </div>

      {/* ── Workspace rail — full width, dedicated to tabs ────────── */}
      <div className="relative h-10 bg-(--color-bg-subtle)">
        <Container className="flex h-full items-center">
          {hasTabs ? (
            <TabBar inline />
          ) : (
            <span className="font-mono text-caption italic text-(--color-fg-faint)">
              open a repo to start a workspace
            </span>
          )}
        </Container>
      </div>
    </header>
  );
}
