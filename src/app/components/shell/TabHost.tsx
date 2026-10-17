import { RouterContextProvider, RouterProvider } from "@tanstack/react-router";
import { Activity, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { CommandPalette } from "@/app/components/CommandPalette";
import { FileHistorySheet } from "@/app/components/code/FileHistorySheet";
import { KeyboardHelp } from "@/app/components/KeyboardHelp";
import { OpenInGithubLink } from "@/app/components/OpenInGithubLink";
import { PageScrollControls } from "@/app/components/PageScrollControls";
import { DocumentTitle } from "@/app/components/shell/DocumentTitle";
import { LinkHoverMenu } from "@/app/components/shell/LinkHoverMenu";
import { TabShortcuts } from "@/app/components/shell/TabShortcuts";
import { TabStrip } from "@/app/components/shell/TabStrip";
import { getTabRouter } from "@/app/lib/tabRouters";
import { useAuthStore } from "@/app/stores/auth";
import { useSettingsStore } from "@/app/stores/settings";
import { useTabsStore } from "@/app/stores/tabs";

// ─── TabHost ───────────────────────────────────────────────────────────────
//
// The app frame:
//
//   ┌ TabStrip ────────────────────────────────────────────┐  global chrome
//   ├ pane (active tab) ───────────────────────────────────┤  own router + scroll
//   │   UnifiedNav (sticky) · page …                        │
//   └──────────────────────────────────────────────────────┘
//
// Recently used tabs stay mounted inside <Activity>: hidden panes keep their
// DOM and React state while their effects (polling, listeners) pause, so
// switching back is a visibility flip — no route load, no remount, no
// skeletons. Tabs beyond the keep-alive budget are released and rebuilt from
// their href on demand.

const KEEP_ALIVE = 8;

export function TabHost() {
  const tabs = useTabsStore((s) => s.tabs);
  const activeId = useTabsStore((s) => s.activeId);
  const tabsEnabled = useSettingsStore((s) => s.tabsEnabled);
  const signedIn = useAuthStore((s) => !!s.token);

  // Most-recently-activated first; trimmed to the keep-alive budget.
  const recent = useRef<string[]>([]);
  const mounted = useMemo(() => {
    if (!activeId) return [];
    const ids = new Set(tabs.map((t) => t.id));
    const next = [activeId, ...recent.current.filter((id) => id !== activeId && ids.has(id))];
    recent.current = tabsEnabled ? next.slice(0, KEEP_ALIVE) : [activeId];
    return recent.current;
  }, [tabs, activeId, tabsEnabled]);

  const active = tabs.find((t) => t.id === activeId);
  const activeRouter = active ? getTabRouter(active.id, active.href) : null;

  return (
    <div className="flex h-full flex-col">
      {tabsEnabled && signedIn && <TabStrip />}
      <div className="relative min-h-0 flex-1">
        {tabs
          .filter((t) => mounted.includes(t.id))
          .map((t) => (
            <Activity key={t.id} mode={t.id === activeId ? "visible" : "hidden"}>
              <TabPane id={t.id} href={t.href} />
            </Activity>
          ))}
      </div>
      {activeRouter && (
        <RouterContextProvider router={activeRouter}>
          <DocumentTitle />
          <TabShortcuts />
          <LinkHoverMenu />
          <CommandPalette />
          <KeyboardHelp />
          <FileHistorySheet />
          <OpenInGithubLink />
        </RouterContextProvider>
      )}
    </div>
  );
}

// Scroll offsets survive hide/show (display:none resets scrollTop). Effects are
// torn down on hide, so this lives outside React.
const scrollMemory = new Map<string, number>();

function TabPane({ id, href }: { id: string; href: string }) {
  const ref = useRef<HTMLDivElement>(null);
  // Built once from the href the tab had when first shown; after that the
  // router itself is the source of truth for its location.
  const [router] = useState(() => getTabRouter(id, href));

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

  return (
    <div
      ref={ref}
      data-tab-pane={id}
      className="absolute inset-0 overflow-y-auto overscroll-contain"
    >
      <RouterProvider router={router} />
      <PageScrollControls scrollerRef={ref} />
    </div>
  );
}
