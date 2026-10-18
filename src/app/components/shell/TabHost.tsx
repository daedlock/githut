import { QueryClientProvider } from "@tanstack/react-query";
import { RouterContextProvider, RouterProvider } from "@tanstack/react-router";
import {
  Activity,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { CommandPalette } from "@/app/components/CommandPalette";
import { FileHistorySheet } from "@/app/components/code/FileHistorySheet";
import { KeyboardHelp } from "@/app/components/KeyboardHelp";
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
import { Toaster } from "@/app/components/ui/sonner";
import { TooltipProvider } from "@/app/components/ui/tooltip";

import { IslandFocusRefresh } from "@/app/lib/freshness";
import { tabQueryClient } from "@/app/lib/query";
import { restoreScroll } from "@/app/lib/scrollRestore";
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
// Each island has a header (tabs, island actions) and a breadcrumb row.
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

  // Open tabs, most recently focused first; keepAliveTabs trims them to the
  // keep-alive budget and adds every island's selected tab and every pin.
  // The set keeps its identity while its members don't change, so renderPanes
  // does too and focusing an island re-renders only the two islands whose
  // focus changed (IslandFrame is memoized on it).
  const recent = useRef<string[]>([]);
  const lastMounted = useRef<ReadonlySet<string> | undefined>(undefined);
  const mounted = useMemo(() => {
    const all = islands(layout);
    const open = new Set(all.flatMap((i) => i.tabs.map((t) => t.id)));
    recent.current = [
      focused.id,
      ...recent.current.filter((id) => id !== focused.id && open.has(id)),
    ];
    lastMounted.current = keepAliveTabs(
      layout,
      recent.current,
      visibleIslandIds(workspace, narrow),
      lastMounted.current,
    );
    return lastMounted.current;
  }, [layout, focused.id, workspace, narrow]);

  // React releases the pane; release its router too. Query data and scroll
  // memory remain available when the page is rebuilt on its next selection.
  useEffect(() => {
    for (const island of islands(layout)) {
      for (const tab of island.tabs) if (!mounted.has(tab.id)) releaseTabRouter(tab.id);
    }
  }, [layout, mounted]);

  const focusedRouter = getTabRouter(focused.id, focused.href);

  const renderPanes = useCallback(
    (island: Island, shown: boolean) =>
      island.tabs
        .filter((t) => mounted.has(t.id))
        .map((t) => (
          <Activity key={t.id} mode={shown && t.id === island.selectedTabId ? "visible" : "hidden"}>
            <TabPane id={t.id} href={t.href} />
          </Activity>
        )),
    [mounted],
  );

  // Signed out (the login page) there is no workspace yet: the focused tab
  // owns the whole window.
  if (!signedIn) {
    return (
      <main className="relative h-full">
        {renderPanes(focusedIsland(workspace), true)}
        <RouterContextProvider router={focusedRouter}>{OVERLAYS}</RouterContextProvider>
      </main>
    );
  }

  return (
    <TooltipProvider delayDuration={500} skipDelayDuration={300}>
      <RepoMarkScope>
        <div className="relative flex h-full flex-col bg-(--color-frame) pt-[max(0.5rem,env(safe-area-inset-top))] pr-[max(0.5rem,env(safe-area-inset-right))] pb-[max(0.5rem,env(safe-area-inset-bottom))] pl-[max(0.5rem,env(safe-area-inset-left))]">
          <RouterContextProvider router={focusedRouter}>
            {OVERLAYS}
            {WORKSPACE_OVERLAYS}
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

// Window-wide overlays. Hoisted so a workspace change (an island focus) re-renders
// only those that read what changed, not every overlay with the host.
const OVERLAYS = (
  <>
    <DocumentTitle />
    <TabShortcuts />
    <LinkHoverMenu />
    <CommandPalette />
    <KeyboardHelp />
    <FileHistorySheet />
  </>
);

// One Toaster for the whole window, centred under the workspace.
const WORKSPACE_OVERLAYS = (
  <>
    <LayoutUndo />
    <Toaster position="bottom-center" />
    <SettingsModal />
  </>
);

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
    const [queries] = useState(() => tabQueryClient(id));
    // Page shortcuts and key listeners only act while this is the focused tab.
    const scope = useMemo<TabScope>(
      () => ({ tabId: id, isFocused: () => getFocusedTab().id === id }),
      [id],
    );

    // Runs on every reveal (Activity re-mounts effects). Nothing here may read
    // or write geometry synchronously: the pane was display:none, so any such
    // access would force a full layout of it inside the click. The restore
    // runs in the next frame instead (still before it paints) and keeps
    // retrying while a rebuilt page is still too short; see restoreScroll.
    useLayoutEffect(() => {
      const el = ref.current;
      if (!el) return;
      const restore = restoreScroll(el, scrollMemory.get(id) ?? 0);
      const onScroll = () => {
        if (!restore.restoring) scrollMemory.set(id, el.scrollTop);
      };
      const interactions = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
      for (const type of interactions) el.addEventListener(type, restore.stop, { passive: true });
      el.addEventListener("scroll", onScroll, { passive: true });
      return () => {
        restore.stop();
        for (const type of interactions) el.removeEventListener(type, restore.stop);
        el.removeEventListener("scroll", onScroll);
      };
    }, [id]);

    // Pages size full-height regions against the pane, not the viewport:
    // `var(--pane-height, 100dvh)`. The observer reports after layout, so on a
    // reveal (the property survives display:none) there is no forced read; only
    // a pane's very first commit measures synchronously, while it is empty.
    useLayoutEffect(() => {
      const el = ref.current;
      if (!el) return;
      const sync = () => {
        const height = `${el.clientHeight}px`;
        if (el.style.getPropertyValue("--pane-height") !== height) {
          el.style.setProperty("--pane-height", height);
        }
      };
      if (!el.style.getPropertyValue("--pane-height")) sync();
      const ro = new ResizeObserver(sync);
      ro.observe(el);
      return () => ro.disconnect();
    }, []);

    return (
      <div
        ref={ref}
        data-tab-pane={id}
        id={`tab-pane-${id}`}
        role="tabpanel"
        aria-labelledby={`tab-${id}`}
        // Focusable so keyboard focus can move into an island (Alt+Shift+arrows).
        tabIndex={-1}
        className="@container/pane absolute inset-0 overflow-y-auto overscroll-contain outline-none"
      >
        <TabScopeContext.Provider value={scope}>
          <QueryClientProvider client={queries}>
            <IslandFocusRefresh />
            <RouterProvider router={router} />
            <PageScrollControls scrollerRef={ref} />
          </QueryClientProvider>
        </TabScopeContext.Provider>
      </div>
    );
  },
  (a, b) => a.id === b.id,
);
