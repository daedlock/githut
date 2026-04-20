import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useMemo } from "react";

import { Container } from "@/app/components/ui/Container";
import { cn } from "@/app/lib/cn";
import { getTabMeta } from "@/app/lib/tabMeta";
import { useSettingsStore } from "@/app/stores/settings";
import { hrefToTabId, useTabsStore } from "@/app/stores/tabs";

/**
 * Section sub-navigation for repo pages (Code | Commits | PRs | Issues).
 * Replaces the broken RepoTabs — wired through openTab() for reuse-or-open
 * semantics instead of plain <Link>.
 *
 * Clicking a sub-tab opens (or focuses) a tab for that section in the tab bar.
 * The active state is derived from the tabs store, not from URL matching.
 */

type SubTab = {
  href: string;
  label: string;
};

export function RepoSubTabs({ owner, repo }: { owner: string; repo: string }) {
  const tabsEnabled = useSettingsStore((s) => s.tabsEnabled);
  const openTab = useTabsStore((s) => s.openTab);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const tabs: SubTab[] = useMemo(
    () => [
      { href: `/${owner}/${repo}/code`, label: "Code" },
      { href: `/${owner}/${repo}/commits`, label: "Commits" },
      { href: `/${owner}/${repo}/pulls`, label: "Pull requests" },
      { href: `/${owner}/${repo}/issues`, label: "Issues" },
    ],
    [owner, repo],
  );

  // Determine which sub-tab matches the current route.
  // We check the actual pathname, not the activeTabId, because within a repo
  // the user may be on a child route (e.g. /commit/sha) that doesn't match
  // any sub-tab — in that case no sub-tab is highlighted.
  const activeHref = useMemo(() => {
    for (const tab of tabs) {
      const tabId = hrefToTabId(tab.href);
      if (pathname === tabId || pathname.startsWith(`${tabId}/`)) {
        return tab.href;
      }
    }
    return null;
  }, [tabs, pathname]);

  function handleClick(href: string) {
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
    <div className="border-b border-border">
      <Container as="nav" className="flex items-end gap-0" aria-label="Repository sections">
        {tabs.map((tab) => {
          const isActive = tab.href === activeHref;
          return (
            <button
              key={tab.href}
              type="button"
              onClick={() => handleClick(tab.href)}
              className={cn(
                "group relative flex items-center gap-1.5 px-3 py-2 text-ui",
                "text-muted-foreground transition-colors hover:text-foreground",
                "focus-visible:text-foreground focus-visible:outline-none",
                isActive && "text-foreground",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <span>{tab.label}</span>
              {isActive && (
                <span aria-hidden className="absolute inset-x-3 -bottom-px h-[2px] bg-primary" />
              )}
            </button>
          );
        })}
      </Container>
    </div>
  );
}
