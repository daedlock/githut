import { RouterContextProvider, RouterProvider } from "@tanstack/react-router";
import { Activity, memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { CommandPalette } from "@/app/components/CommandPalette";
import { FileHistorySheet } from "@/app/components/code/FileHistorySheet";
import { KeyboardHelp } from "@/app/components/KeyboardHelp";
import { OpenInGithubLink } from "@/app/components/OpenInGithubLink";
import { PageScrollControls } from "@/app/components/PageScrollControls";
import { DocumentTitle } from "@/app/components/shell/DocumentTitle";
import { IslandLayout } from "@/app/components/shell/IslandLayout";
import { LayoutUndo } from "@/app/components/shell/LayoutUndo";
import { LinkHoverMenu } from "@/app/components/shell/LinkHoverMenu";
import { TabShortcuts } from "@/app/components/shell/TabShortcuts";
import { TitleBar } from "@/app/components/shell/TitleBar";
import { TooltipProvider } from "@/app/components/ui/tooltip";
import { cn } from "@/app/lib/cn";
import { getTabRouter } from "@/app/lib/tabRouters";
import { type TabScope, TabScopeContext } from "@/app/lib/tabScope";
import { useAuthStore } from "@/app/stores/auth";
import { useSettingsStore } from "@/app/stores/settings";
import { focusedIsland, focusedTab, type Island, islands } from "@/app/workspace/model";
import { getFocusedTab, useWorkspaceStore } from "@/app/workspace/store";

// ─── TabHost ───────────────────────────────────────────────────────────────
//
// The islands workspace frame:
//
//   ┌ TitleBar (frame) ─ logo · focused repo ⎇ branch · ⌘K · avatar ─┐
//   │ ╭ Island ───────────────────╮ ┊ ╭ Island ──────────────────────╮ │
//   │ │ tabs …   sections  ▥      │ ┊ │ tabs …   sections  ▥         │ │
//   │ │ pane (selected tab)       │ ┊ │ pane (selected tab)          │ │
//   │ ╰───────────────────────────╯ ┊ ╰──────────────────────────────╯ │
//   └──────────────────────────────────────────────────────────────────┘
//
// Pages carry no navigation chrome of their own: identity, search and
// account live in the title bar; repo sections live in each island header.
// The layout itself is drawn by IslandLayout.
//
// Recently used tabs stay mounted inside <Activity>: hidden panes keep their
// DOM and React state while their effects (polling, listeners) pause, so
// switching back is a visibility flip — no route load, no remount, no
// skeletons. Every island's selected tab is mounted; beyond that, the most
// recently focused tabs up to the keep-alive budget stay mounted, and the
// rest are released and rebuilt from their href on demand.

const KEEP_ALIVE = 8;

export function TabHost() {
  const workspace = useWorkspaceStore((s) => s.workspace);
  const { layout, focusedIslandId, maximizedIslandId } = workspace;
  const focused = focusedTab(workspace);
  const tabsEnabled = useSettingsStore((s) => s.tabsEnabled);
  const signedIn = useAuthStore((s) => !!s.token);

  // Most recently focused first, trimmed to the keep-alive budget; every
  // island's selected tab is mounted on top of that.
  const recent = useRef<string[]>([]);
  const mounted = useMemo(() => {
    const all = islands(layout);
    const open = new Set(all.flatMap((i) => i.tabs.map((t) => t.id)));
    const next = [focused.id, ...recent.current.filter((id) => id !== focused.id && open.has(id))];
    recent.current = tabsEnabled ? next.slice(0, KEEP_ALIVE) : [focused.id];
    return new Set([...recent.current, ...all.map((i) => i.selectedTabId)]);
  }, [layout, focused.id, tabsEnabled]);

  const focusedRouter = getTabRouter(focused.id, focused.href);

  const renderPanes = (island: Island, shown: boolean) =>
    island.tabs
      .filter((t) => mounted.has(t.id))
      .map((t) => (
        <Activity key={t.id} mode={shown && t.id === island.selectedTabId ? "visible" : "hidden"}>
          <TabPane id={t.id} href={t.href} />
        </Activity>
      ));

  const overlays = (
    <>
      <DocumentTitle />
      <TabShortcuts />
      <LinkHoverMenu />
      <CommandPalette />
      <KeyboardHelp />
      <FileHistorySheet />
      <OpenInGithubLink />
    </>
  );

  // Signed out (the login page) there is no workspace yet: the focused tab
  // owns the whole window.
  if (!signedIn) {
    return (
      <div className="relative h-full">
        {renderPanes(focusedIsland(workspace), true)}
        <RouterContextProvider router={focusedRouter}>{overlays}</RouterContextProvider>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={500} skipDelayDuration={300}>
      <div
        className={cn(
          "flex h-full flex-col bg-(--color-frame)",
          "pr-[max(1rem,env(safe-area-inset-right))] pb-2 pl-[max(1rem,env(safe-area-inset-left))]",
        )}
      >
        <RouterContextProvider router={focusedRouter}>
          <TitleBar focusedHref={focused.href} />
          {overlays}
          <LayoutUndo />
        </RouterContextProvider>
        <IslandLayout
          layout={layout}
          focusedIslandId={focusedIslandId}
          maximizedIslandId={maximizedIslandId}
          renderPanes={renderPanes}
        />
      </div>
    </TooltipProvider>
  );
}

// Scroll offsets survive hide/show (display:none resets scrollTop). Effects are
// torn down on hide, so this lives outside React.
const scrollMemory = new Map<string, number>();

/**
 * One tab's page: its own router and scroll container. Only the id matters
 * after mount — the router is built once from the href the tab had when first
 * shown and is the source of truth for its location from then on.
 */
const TabPane = memo(
  function TabPane({ id, href }: { id: string; href: string }) {
    const ref = useRef<HTMLDivElement>(null);
    const [router] = useState(() => getTabRouter(id, href));
    // Page shortcuts and key listeners only act while this is the focused tab.
    const scope = useMemo<TabScope>(
      () => ({ tabId: id, isFocused: () => getFocusedTab().id === id }),
      [id],
    );

    // Runs on every reveal (Activity re-mounts effects), before paint.
    useLayoutEffect(() => {
      const el = ref.current;
      if (el) el.scrollTop = scrollMemory.get(id) ?? 0;
    }, [id]);

    useEffect(() => {
      const el = ref.current;
      if (!el) return;
      const onScroll = () => scrollMemory.set(id, el.scrollTop);
      el.addEventListener("scroll", onScroll, { passive: true });
      return () => el.removeEventListener("scroll", onScroll);
    }, [id]);

    // Pages size full-height regions against the pane, not the viewport:
    // `var(--pane-height, 100dvh)`.
    useLayoutEffect(() => {
      const el = ref.current;
      if (!el) return;
      const sync = () => el.style.setProperty("--pane-height", `${el.clientHeight}px`);
      sync();
      const ro = new ResizeObserver(sync);
      ro.observe(el);
      return () => ro.disconnect();
    }, []);

    return (
      <div
        ref={ref}
        data-tab-pane={id}
        // Focusable so keyboard focus can move into an island (Alt+Shift+arrows).
        tabIndex={-1}
        className="absolute inset-0 overflow-y-auto overscroll-contain outline-none [--app-header-height:0px]"
      >
        <TabScopeContext.Provider value={scope}>
          <RouterProvider router={router} />
          <PageScrollControls scrollerRef={ref} />
        </TabScopeContext.Provider>
      </div>
    );
  },
  (a, b) => a.id === b.id,
);
