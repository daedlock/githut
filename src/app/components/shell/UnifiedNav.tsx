import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useMemo } from "react";
import { Avatar } from "@/app/components/ui/avatar";
import { UserMenu } from "@/app/components/shell/UserMenu";
import { useMe } from "@/app/hooks/useMe";
import { logout, manageGitHubAccess } from "@/app/lib/auth";
import { cn } from "@/app/lib/cn";
import { useCommandPalette } from "@/app/stores/commandPalette";
import { getTabMeta } from "@/app/lib/tabMeta";
import { useSettingsStore } from "@/app/stores/settings";
import { hrefToTabId, useTabsStore } from "@/app/stores/tabs";

// ─── UnifiedNav ────────────────────────────────────────────────────────────
//
// One bar to rule them all. A single h-10 row replaces the previous
// TopBar (h-9) + RepoSubTabs (~40px) — saving ~30px of vertical space
// and eliminating the stacked-sticky-bar problem.
//
// Layout:
//   [owner/repo avatar] [owner / repo] │ Code Commits PRs Issues Actions  ──  [⌘K] [avatar]
//
// When NOT on a repo page, the left side shows nothing (or could show
// a home breadcrumb). The section tabs disappear. The bar simplifies to:
//   ──────────────────────────────────────────────────────  [⌘K] [avatar]
//
// Design language:
//   • h-10 (40px) — compact but breathable
//   • No logo — the owner/repo identity IS the brand context
//   • Mono font for paths — matches GitHub's technical feel
//   • Underline-on-active tabs — same 2px primary indicator
//   • Full-width — no Container constraint (content below can Container itself)

type RepoContext = {
  owner: string;
  repo: string;
} | null;

export function UnifiedNav({ repoContext }: { repoContext?: RepoContext }) {
  const { data: me } = useMe();
  const { open: openPalette } = useCommandPalette();

  return (
    <header className="flex h-10 min-h-10 w-full shrink-0 items-center gap-0 overflow-hidden border-b border-border bg-background px-3 sm:px-4">
      {/* Left: repo identity + section tabs (when in repo context) */}
      {repoContext ? (
        <RepoSection owner={repoContext.owner} repo={repoContext.repo} />
      ) : (
        <HomeSection />
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right: search + profile */}
      <div className="flex items-center gap-2">
        <SearchTrigger onClick={openPalette} />
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

// ─── Repo section ──────────────────────────────────────────────────────────

const REPO_TABS = [
  { suffix: "/code", label: "Code" },
  { suffix: "/commits", label: "Commits" },
  { suffix: "/pulls", label: "PRs" },
  { suffix: "/issues", label: "Issues" },
  { suffix: "/actions", label: "Actions" },
] as const;

function RepoSection({ owner, repo }: { owner: string; repo: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const tabsEnabled = useSettingsStore((s) => s.tabsEnabled);
  const openTab = useTabsStore((s) => s.openTab);
  const navigate = useNavigate();

  const tabs = useMemo(
    () =>
      REPO_TABS.map((t) => ({
        href: `/${owner}/${repo}${t.suffix}`,
        label: t.label,
      })),
    [owner, repo],
  );

  const activeHref = useMemo(() => {
    for (const tab of tabs) {
      const tabId = hrefToTabId(tab.href);
      if (pathname === tabId || pathname.startsWith(`${tabId}/`)) return tab.href;
    }
    return null;
  }, [tabs, pathname]);

  function handleTabClick(href: string) {
    if (tabsEnabled) {
      const meta = getTabMeta(hrefToTabId(href));
      openTab(href, {
        label: meta.label,
        sublabel: meta.sublabel,
        icon: meta.icon.displayName ?? meta.icon.name ?? "File",
      });
    } else {
      navigate({ to: href });
    }
  }

  return (
    <div className="flex h-full items-stretch gap-0">
      {/* Avatar + owner/repo */}
      <div className="flex items-center gap-2 pr-3 mr-1">
        <Link
          to="/$username"
          params={{ username: owner }}
          className="shrink-0 rounded-full outline-none transition-opacity hover:opacity-80 focus-visible:ring-1 focus-visible:ring-(--color-focus)"
        >
          <Avatar
            login={owner}
            avatarUrl={`https://github.com/${owner}.png?size=40`}
            size="sm"
          />
        </Link>
        <div className="flex items-baseline gap-0.5 font-mono text-caption leading-none">
          <Link
            to="/$username"
            params={{ username: owner }}
            className="text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none"
          >
            {owner}
          </Link>
          <span className="text-[var(--color-fg-faint)]">/</span>
          <Link
            to="/$owner/$repo/code"
            params={{ owner, repo }}
            className="font-medium text-foreground transition-colors hover:text-[var(--color-accent)] focus-visible:outline-none"
          >
            {repo}
          </Link>
        </div>
      </div>

      <nav className="flex items-stretch gap-0" aria-label="Repository sections">
        {tabs.map((tab) => {
          const isActive = tab.href === activeHref;
          return (
            <button
              key={tab.href}
              type="button"
              onClick={() => handleTabClick(tab.href)}
              className={cn(
                "group relative flex items-center whitespace-nowrap px-2.5 text-caption",
                "text-muted-foreground outline-none transition-colors",
                "hover:text-foreground focus-visible:text-foreground",
                isActive && "text-foreground",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <span>{tab.label}</span>
              {isActive && (
                <span
                  aria-hidden
                  className="absolute inset-x-2.5 -bottom-px h-[2px] rounded-full bg-primary"
                />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

// ─── Home section (non-repo pages) ─────────────────────────────────────────

function HomeSection() {
  return (
    <Link
      to="/"
      className="flex items-center gap-1.5 font-mono text-caption font-medium text-foreground outline-none transition-opacity hover:opacity-70 focus-visible:ring-1 focus-visible:ring-(--color-focus) rounded-sm px-1"
    >
      Dashboard
    </Link>
  );
}

// ─── Search trigger ────────────────────────────────────────────────────────

function SearchTrigger({ onClick }: { onClick: () => void }) {
  const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open command palette"
      className={cn(
        "inline-flex h-6.5 items-center gap-1.5 rounded-md",
        "border border-border bg-[var(--color-bg-subtle)]",
        "pl-2 pr-1.5 text-muted-foreground outline-none",
        "transition-colors hover:bg-[var(--color-bg-sunken)] hover:text-foreground",
        "focus-visible:ring-1 focus-visible:ring-(--color-focus)",
      )}
    >
      <Search className="size-3 shrink-0" />
      <span className="hidden text-micro sm:inline">Search</span>
      <kbd className="rounded border border-border bg-background px-1 py-px font-mono text-[10px] leading-none text-muted-foreground">
        {mac ? "⌘K" : "^K"}
      </kbd>
    </button>
  );
}
