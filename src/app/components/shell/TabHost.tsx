import { RouterContextProvider, RouterProvider } from "@tanstack/react-router";
import { Activity, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { CommandPalette } from "@/app/components/CommandPalette";
import { FileHistorySheet } from "@/app/components/code/FileHistorySheet";
import { KeyboardHelp } from "@/app/components/KeyboardHelp";
import { OpenInGithubLink } from "@/app/components/OpenInGithubLink";
import { PageScrollControls } from "@/app/components/PageScrollControls";
import { DocumentTitle } from "@/app/components/shell/DocumentTitle";
import { LinkHoverMenu } from "@/app/components/shell/LinkHoverMenu";
import { SectionMenu } from "@/app/components/shell/SectionMenu";
import { SignInBanner } from "@/app/components/shell/SessionNotices";
import { TabShortcuts } from "@/app/components/shell/TabShortcuts";
import { TabStrip } from "@/app/components/shell/TabStrip";
import { TitleBar } from "@/app/components/shell/TitleBar";
import { TooltipProvider } from "@/app/components/ui/tooltip";
import { cn } from "@/app/lib/cn";
import { getTabMeta } from "@/app/lib/tabMeta";
import { getTabRouter } from "@/app/lib/tabRouters";
import { useAuthStore } from "@/app/stores/auth";
import { useSettingsStore } from "@/app/stores/settings";
import { hrefPathname, useTabsStore } from "@/app/stores/tabs";

// ─── TabHost ───────────────────────────────────────────────────────────────
//
// The islands workspace frame:
//
//   ┌ TitleBar (frame) ─ logo · focused repo ⎇ branch · ⌘K · avatar ─┐
//   │ ╭ Island ─────────────────────────────────────────────────────╮ │
//   │ │ tabs …                                  ⌂ ⎇ ⇅ ◎ ▷ sections  │ │
//   │ │ pane (selected tab) — own router + scroll                    │ │
//   │ ╰──────────────────────────────────────────────────────────────╯ │
//   └──────────────────────────────────────────────────────────────────┘
//
// Pages carry no navigation chrome of their own: identity, search and
// account live in the title bar; repo sections live in the island header.
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

  const panes = tabs
    .filter((t) => mounted.includes(t.id))
    .map((t) => (
      <Activity key={t.id} mode={t.id === activeId ? "visible" : "hidden"}>
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

  // Signed out (the login page) there is no workspace yet: the page owns the
  // whole window.
  if (!signedIn) {
    return (
      <div className="relative h-full">
        {panes}
        {activeRouter && (
          <RouterContextProvider router={activeRouter}>{overlays}</RouterContextProvider>
        )}
      </div>
    );
  }

  const islandLabel = active ? islandName(active.href) : "Island";

  return (
    <TooltipProvider delayDuration={500} skipDelayDuration={300}>
      <div
        className={cn(
          "relative flex h-full flex-col bg-(--color-frame)",
          "pr-[max(1rem,env(safe-area-inset-right))] pb-2 pl-[max(1rem,env(safe-area-inset-left))]",
        )}
      >
        {activeRouter ? (
          <RouterContextProvider router={activeRouter}>
            <TitleBar focusedHref={active?.href ?? null} />
            {overlays}
          </RouterContextProvider>
        ) : (
          <TitleBar focusedHref={null} />
        )}
        <section
          aria-label={islandLabel}
          data-island
          data-focused
          className={cn(
            "@container flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-island bg-background",
            "shadow-(--island-shadow-focus) transition-shadow duration-150",
          )}
        >
          <div data-link-menu="off" className="flex h-10 shrink-0 items-center gap-1 pr-1.5 pl-1">
            <TabStrip focused />
            {active && <SectionMenu href={active.href} />}
          </div>
          <div className="relative min-h-0 flex-1">{panes}</div>
        </section>
        <SignInBanner />
      </div>
    </TooltipProvider>
  );
}

/** Accessible island name: its selected tab's page and repo. */
function islandName(href: string): string {
  const pathname = hrefPathname(href);
  const meta = getTabMeta(pathname);
  return meta.sublabel ? `${meta.label} · ${meta.sublabel}` : meta.label;
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
      className="absolute inset-0 overflow-y-auto overscroll-contain [--app-header-height:0px]"
    >
      <RouterProvider router={router} />
      <PageScrollControls scrollerRef={ref} />
    </div>
  );
}
