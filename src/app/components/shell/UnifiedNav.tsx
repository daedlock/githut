import {
  CodeIcon,
  GitCommitIcon,
  GitPullRequestIcon,
  IssueOpenedIcon,
  PlayIcon,
} from "@primer/octicons-react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useMemo } from "react";
import { UserMenu } from "@/app/components/shell/UserMenu";
import { Avatar } from "@/app/components/ui/avatar";
import { Container } from "@/app/components/ui/Container";
import { Skeleton } from "@/app/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/app/components/ui/tooltip";
import { useMe } from "@/app/hooks/useMe";
import { logout, manageGitHubAccess } from "@/app/lib/auth";
import { cn } from "@/app/lib/cn";
import { getTabMeta } from "@/app/lib/tabMeta";
import { useCommandPalette } from "@/app/stores/commandPalette";
import { useSettingsStore } from "@/app/stores/settings";
import { hrefToTabId, useTabsStore } from "@/app/stores/tabs";

// ─── UnifiedNav ────────────────────────────────────────────────────────────
//
// A compact row on desktop; repository sections get their own row on mobile.
//
// Layout:
//   [logo] [owner avatar] [owner / repo] │ Code Commits PRs Issues Actions  ──  [⌘K] [avatar]
//
// Design language:
//   • h-10 (40px) — compact but breathable
//   • Logo always returns to the dashboard
//   • Mono font for paths — matches GitHub's technical feel
//   • Underline-on-active tabs — same 2px primary indicator
//   • Shared Container bounds keep navigation aligned with page content

type RepoContext = {
  owner: string;
  repo: string;
} | null;

export function UnifiedNav({ repoContext }: { repoContext?: RepoContext }) {
  const { data: me, isPending: mePending } = useMe();
  const { open: openPalette } = useCommandPalette();

  return (
    <header className="h-(--app-header-height) w-full shrink-0 border-b border-border bg-background">
      <TooltipProvider delayDuration={300}>
        <Container className="flex min-h-10 flex-wrap items-center md:flex-nowrap">
          <LogoLink />

          {/* Left: repo identity + section tabs (when in repo context) */}
          {repoContext && <RepoSection owner={repoContext.owner} repo={repoContext.repo} />}

          {/* Right: search + profile */}
          <div className="order-2 ml-auto flex h-10 shrink-0 items-center gap-2 pl-2 md:order-3">
            <SearchTrigger onClick={openPalette} />
            {mePending && <Skeleton className="size-7 shrink-0 rounded-full" />}
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
      </TooltipProvider>
    </header>
  );
}

function LogoLink() {
  return (
    <Link
      to="/"
      aria-label="Go to dashboard"
      className="group mr-2 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-1 focus-visible:ring-(--color-focus)"
    >
      <svg
        width="21"
        height="21"
        viewBox="0 0 100 100"
        aria-hidden="true"
        className="shrink-0 transition-colors"
      >
        <path
          fillRule="evenodd"
          fill="currentColor"
          d="M50 4 A46 46 0 1 1 50 96 A46 46 0 1 1 50 4 Z M54 32 L67 43 Q71 47 71 52 L71 62 Q71 68 65 68 L35 68 Q29 68 29 62 L29 52 Q29 47 33 43 L46 32 Q50 28 54 32 Z"
        />
      </svg>
    </Link>
  );
}

// ─── Repo section ──────────────────────────────────────────────────────────

const REPO_TABS = [
  { suffix: "/code", label: "Code", icon: CodeIcon },
  { suffix: "/commits", label: "Commits", icon: GitCommitIcon },
  { suffix: "/pulls", label: "PRs", icon: GitPullRequestIcon },
  { suffix: "/issues", label: "Issues", icon: IssueOpenedIcon },
  { suffix: "/actions", label: "Actions", icon: PlayIcon },
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
        icon: t.icon,
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
    <>
      {/* Avatar + owner/repo */}
      <div className="order-1 flex h-10 min-w-0 flex-1 items-center gap-1.5 md:max-w-72 md:flex-initial">
        <Link
          to="/$username"
          params={{ username: owner }}
          aria-label={`${owner}'s profile`}
          className="shrink-0 rounded-full outline-none transition-opacity hover:opacity-80 focus-visible:ring-1 focus-visible:ring-(--color-focus)"
        >
          <Avatar
            login={owner}
            avatarUrl={`https://github.com/${owner}.png?size=32`}
            size="xs"
            className="opacity-85"
          />
        </Link>
        <div className="flex min-w-0 flex-1 items-baseline gap-1 font-mono text-ui">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/$username"
                params={{ username: owner }}
                className="min-w-0 max-w-[45%] shrink truncate rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-(--color-focus)"
              >
                {owner}
              </Link>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              align="start"
              sideOffset={8}
              className="break-all font-mono"
            >
              {owner}
            </TooltipContent>
          </Tooltip>
          <span className="shrink-0 text-[var(--color-fg-faint)]">/</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/$owner/$repo/code"
                params={{ owner, repo }}
                className="min-w-0 truncate rounded-sm font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-(--color-focus)"
              >
                {repo}
              </Link>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              align="start"
              sideOffset={8}
              className="break-all font-mono"
            >
              {repo}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <span
        aria-hidden
        className="order-1 mx-2 my-auto hidden h-4 w-px shrink-0 bg-border md:block"
      />

      <nav
        className="order-3 flex h-10 w-full min-w-0 items-stretch overflow-x-auto md:order-2 md:w-auto md:shrink-0"
        aria-label="Repository sections"
      >
        {tabs.map((tab) => {
          const isActive = tab.href === activeHref;
          const Icon = tab.icon;
          return (
            <button
              key={tab.href}
              type="button"
              onClick={() => handleTabClick(tab.href)}
              className={cn(
                "group relative flex flex-1 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2 text-ui md:flex-none md:px-2.5",
                "text-muted-foreground outline-none transition-colors",
                "hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground",
                isActive && "text-foreground",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon aria-hidden className="hidden size-4 shrink-0 sm:block" />
              <span>{tab.label}</span>
              {isActive && (
                <span
                  aria-hidden
                  className="absolute inset-x-2.5 bottom-0 h-[2px] rounded-full bg-primary"
                />
              )}
            </button>
          );
        })}
      </nav>
    </>
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
        "border border-border bg-muted",
        "pl-2 pr-1.5 text-muted-foreground outline-none",
        "transition-colors hover:bg-[var(--color-bg-sunken)] hover:text-foreground",
        "focus-visible:ring-1 focus-visible:ring-(--color-focus)",
      )}
    >
      <Search className="size-3 shrink-0" />
      <span className="hidden text-micro lg:inline">Search</span>
      <kbd className="rounded border border-border bg-background px-1 py-px font-mono text-[10px] leading-none text-muted-foreground">
        {mac ? "⌘K" : "^K"}
      </kbd>
    </button>
  );
}
