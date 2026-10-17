import { QueryClientProvider } from "@tanstack/react-query";
import { RouterContextProvider, RouterProvider } from "@tanstack/react-router";
import { Activity, memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { CommandPalette } from "@/app/components/CommandPalette";
import { FileHistorySheet } from "@/app/components/code/FileHistorySheet";
import { KeyboardHelp } from "@/app/components/KeyboardHelp";
import { OpenInGithubLink } from "@/app/components/OpenInGithubLink";
import { PageScrollControls } from "@/app/components/PageScrollControls";
import { SettingsModal } from "@/app/components/settings/SettingsModal";
import { DocumentTitle } from "@/app/components/shell/DocumentTitle";
import { IslandLayout } from "@/app/components/shell/IslandLayout";
import { LayoutUndo } from "@/app/components/shell/LayoutUndo";
import { LinkHoverMenu } from "@/app/components/shell/LinkHoverMenu";
import { RepoMarkScope } from "@/app/components/shell/RepoMark";
import { SignInBanner, WorkspaceNotices } from "@/app/components/shell/SessionNotices";
import { TabShortcuts } from "@/app/components/shell/TabShortcuts";

import { WorkspaceArea } from "@/app/components/shell/WorkspaceArea";
import { TooltipProvider } from "@/app/components/ui/tooltip";

import { queryClientForTab, startWorkspaceFreshness } from "@/app/lib/freshness";
import { queryClient } from "@/app/lib/query";
import { getTabRouter, releaseTabRouter } from "@/app/lib/tabRouters";
import { type TabScope, TabScopeContext } from "@/app/lib/tabScope";
import { useAuthStore } from "@/app/stores/auth";
import { useWorkspaceView } from "@/app/stores/workspaceView";
import { focusedIsland, focusedTab, type Island, islands } from "@/app/workspace/model";
import { getFocusedTab, useWorkspaceStore } from "@/app/workspace/store";
import { keepAliveTabs } from "@/app/workspace/tabLifetime";
import { visibleIslandIds } from "@/app/workspace/view";

// ─── TabHost ───────────────────────────────────────────────────────────────
//
// Sidebar controls sit beside the full-height islands, inside a consistent frame gutter.
// Repo sections and contextual controls live in each island header.
// The layout itself is drawn by IslandLayout.
//
// Recently used tabs stay mounted inside <Activity>: hidden panes keep their
// DOM and React state while their effects (polling, listeners) pause, so
// switching back is a visibility flip — no route load, no remount, no
// skeletons. Every island's selected tab is mounted; beyond that, the most
// recently focused tabs up to the keep-alive budget stay mounted, and the
// rest are released and rebuilt from their href on demand.

export function TabHost() {
  const workspace = useWorkspaceStore((s) => s.workspace);
  const { layout, focusedIslandId, maximizedIslandId } = workspace;
  const focused = focusedTab(workspace);
  const signedIn = useAuthStore((s) => !!s.token);
  const narrow = useWorkspaceView((s) => s.narrow);
  useEffect(() => (signedIn ? startWorkspaceFreshness(queryClient) : undefined), [signedIn]);

  // Open tabs, most recently focused first; keepAliveTabs trims them to the
  // keep-alive budget and adds every island's selected tab and every pin.
  const recent = useRef<string[]>([]);
  const mounted = useMemo(() => {
    const all = islands(layout);
    const open = new Set(all.flatMap((i) => i.tabs.map((t) => t.id)));
    recent.current = [
      focused.id,
      ...recent.current.filter((id) => id !== focused.id && open.has(id)),
    ];
    return keepAliveTabs(layout, recent.current, visibleIslandIds(workspace, narrow));
  }, [layout, focused.id, workspace, narrow]);

  // React releases the pane; release its router too. Query data and scroll
  // memory remain available when the page is rebuilt on its next selection.
  useEffect(() => {
    for (const island of islands(layout)) {
      for (const tab of island.tabs) if (!mounted.has(tab.id)) releaseTabRouter(tab.id);
    }
  }, [layout, mounted]);

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
      <RepoMarkScope>
        <div className="relative flex h-full flex-col bg-(--color-frame) pt-[max(0.5rem,env(safe-area-inset-top))] pr-[max(0.5rem,env(safe-area-inset-right))] pb-[max(0.5rem,env(safe-area-inset-bottom))] pl-[max(0.5rem,env(safe-area-inset-left))]">
          <RouterContextProvider router={focusedRouter}>
            {overlays}
            <LayoutUndo />
            <SettingsModal />
            <WorkspaceArea>
              <IslandLayout
                layout={layout}
                focusedIslandId={focusedIslandId}
                maximizedIslandId={maximizedIslandId}
                narrow={narrow}
                renderPanes={renderPanes}
              />
            </WorkspaceArea>
          </RouterContextProvider>
          <WorkspaceNotices />
          <SignInBanner />
        </div>
      </RepoMarkScope>
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
    const queries = useMemo(() => queryClientForTab(queryClient, id), [id]);
    // Page shortcuts and key listeners only act while this is the focused tab.
    const scope = useMemo<TabScope>(
      () => ({ tabId: id, isFocused: () => getFocusedTab().id === id }),
      [id],
    );

    // Runs on every reveal (Activity re-mounts effects), before paint. A tab
    // rebuilt after its router was released has no content on first commit
    // (the router loads in an effect), so keep restoring each frame until the
    // page is tall enough, the user scrolls, or a few seconds pass.
    useLayoutEffect(() => {
      const el = ref.current;
      if (!el) return;
      const target = scrollMemory.get(id) ?? 0;
      let frame = 0;
      let restoring = true;
      const stop = () => {
        restoring = false;
        cancelAnimationFrame(frame);
      };
      const deadline = performance.now() + 3000;
      const restore = () => {
        el.scrollTop = target;
        if (Math.abs(el.scrollTop - target) <= 1 || performance.now() > deadline) stop();
        else frame = requestAnimationFrame(restore);
      };
      const onScroll = () => {
        if (!restoring) scrollMemory.set(id, el.scrollTop);
      };
      restore();
      const interactions = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
      for (const type of interactions) el.addEventListener(type, stop, { passive: true });
      el.addEventListener("scroll", onScroll, { passive: true });
      return () => {
        stop();
        for (const type of interactions) el.removeEventListener(type, stop);
        el.removeEventListener("scroll", onScroll);
      };
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
        className="@container/pane absolute inset-0 overflow-y-auto overscroll-contain outline-none [--app-header-height:0px]"
      >
        <TabScopeContext.Provider value={scope}>
          <QueryClientProvider client={queries}>
            <RouterProvider router={router} />
            <PageScrollControls scrollerRef={ref} />
          </QueryClientProvider>
        </TabScopeContext.Provider>
      </div>
    );
  },
  (a, b) => a.id === b.id,
);
