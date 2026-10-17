import { useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { type KeyboardEvent, memo, useEffect, useRef, useSyncExternalStore } from "react";

import { DockingMenu } from "@/app/components/shell/DockingMenu";
import { RepoMark } from "@/app/components/shell/RepoMark";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/app/components/ui/context-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import { issueDetailQueryOptions, issueKeys } from "@/app/features/issues/hooks";
import { prDetailQueryOptions, pullsKeys } from "@/app/features/pulls/hooks";
import { usePageHasDraft } from "@/app/hooks/usePageHasDraft";
import { cn } from "@/app/lib/cn";
import {
  closeOtherTabs,
  closeTab,
  closeTabsToRight,
  duplicateTab,
  reopenClosedTab,
  selectTab,
} from "@/app/lib/tabActions";
import { getTabMeta, type TabMeta } from "@/app/lib/tabMeta";
import { useAuthStore } from "@/app/stores/auth";
import { useTabTitlesStore } from "@/app/stores/tabTitles";
import { hrefPathname, type Island, type Tab } from "@/app/workspace/model";
import { useWorkspaceStore } from "@/app/workspace/store";

// ─── TabStrip ──────────────────────────────────────────────────────────────
//
// The tab row in an island header. Tabs are rounded chips on the island
// surface: each shows its repo mark, a state-coloured icon, the mono number
// and the title. The selected tab is raised onto bg-muted with a hairline;
// in the focused island it carries a faint brand tint instead.
//
// Interaction is immediate: tabs activate on pointerdown, nothing animates.
//   click → switch · middle-click / × → close · drag → reorder
//   right-click → close / close others / close to the right / duplicate / …

export function TabStrip({ island, focused }: { island: Island; focused: boolean }) {
  const { tabs, selectedTabId } = island;
  const scroller = useRef<HTMLDivElement>(null);

  // Vertical wheel scrolls the strip sideways when it overflows.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Keep the selected tab in view. scrollLeft math, not scrollIntoView, so no
  // ancestor (the page, the island) ever scrolls along with the strip.
  useEffect(() => {
    const strip = scroller.current;
    const sel = strip?.querySelector<HTMLElement>(`[data-tab-id="${selectedTabId}"]`);
    if (!strip || !sel) return;
    const reveal = () => {
      const left = sel.offsetLeft - 2;
      const right = sel.offsetLeft + sel.offsetWidth + 2;
      if (left < strip.scrollLeft) strip.scrollLeft = left;
      else if (right > strip.scrollLeft + strip.clientWidth) {
        strip.scrollLeft = right - strip.clientWidth;
      }
    };
    reveal();
    // Titles arrive after first paint and the island can resize: re-check.
    const ro = new ResizeObserver(reveal);
    ro.observe(sel);
    ro.observe(strip);
    return () => ro.disconnect();
  }, [selectedTabId]);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const items = [...e.currentTarget.querySelectorAll<HTMLElement>("[role=tab]")];
    const idx = items.indexOf(document.activeElement as HTMLElement);
    if (idx === -1) return;
    e.preventDefault();
    items[(idx + (e.key === "ArrowRight" ? 1 : -1) + items.length) % items.length]?.focus();
  }

  return (
    <div
      ref={scroller}
      data-tab-strip
      role="tablist"
      aria-label="Open tabs"
      onKeyDown={onKeyDown}
      className={cn(
        "relative flex h-full min-w-0 flex-1 select-none items-center gap-0.5 overflow-x-auto",
        // Room for the selected tab's outline, which the scroller would clip.
        "px-0.5 [scroll-padding-inline:2px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
      )}
    >
      {tabs.map((tab, i) => (
        <TabItem
          key={tab.id}
          tab={tab}
          selected={tab.id === selectedTabId}
          focused={focused}
          isLast={i === tabs.length - 1}
        />
      ))}
    </div>
  );
}

// ─── Tab ───────────────────────────────────────────────────────────────────

const TONE_CLASS: Record<Tone, string> = {
  none: "text-muted-foreground",
  open: "text-(--color-success)",
  merged: "text-(--color-pr-merged)",
  closed: "text-(--color-danger)",
  done: "text-(--color-pr-merged)",
  draft: "text-(--color-fg-faint)",
};

const TabItem = memo(function TabItem({
  tab,
  selected,
  focused,
  isLast,
}: {
  tab: Tab;
  selected: boolean;
  focused: boolean;
  isLast: boolean;
}) {
  const display = useTabDisplay(tab.href);
  const draft = usePageHasDraft(tab.href);
  const hasClosed = useWorkspaceStore((s) => s.workspace.closed.length > 0);
  const Icon = display.icon;

  return (
    <ContextMenu>
      <Tooltip>
        <ContextMenuTrigger asChild>
          <TooltipTrigger asChild>
            <div
              role="tab"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              data-tab-id={tab.id}
              onPointerDown={(e) => {
                if (e.button === 0) selectTab(tab.id);
              }}
              onMouseDown={(e) => e.button === 1 && e.preventDefault()}
              onAuxClick={(e) => e.button === 1 && closeTab(tab.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  selectTab(tab.id);
                } else if (e.key === "Delete") {
                  closeTab(tab.id);
                }
              }}
              className={cn(
                "group relative flex h-7 min-w-16 max-w-[220px] shrink-0 cursor-default items-center gap-1.5 rounded-lg pl-2 pr-1",
                "text-ui outline-none focus-visible:ring-1 focus-visible:ring-(--color-focus)",
                !selected &&
                  "text-muted-foreground hover:bg-[color-mix(in_oklab,var(--color-bg-sunken)_60%,transparent)] hover:text-foreground",
                selected &&
                  !focused &&
                  "bg-muted text-foreground shadow-[0_0_0_1px_var(--color-border),0_1px_2px_rgb(0_0_0/0.12)]",
                selected &&
                  focused && [
                    "bg-[color-mix(in_oklab,var(--color-brand)_9%,var(--color-bg-subtle))] text-foreground",
                    "shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-brand)_45%,var(--color-border)),0_1px_2px_rgb(0_0_0/0.14)]",
                  ],
              )}
            >
              {display.repo && <RepoMark repo={display.repo} size="sm" />}
              <Icon aria-hidden className={cn("size-3.5 shrink-0", TONE_CLASS[display.tone])} />
              {display.prefix && (
                <span className="shrink-0 font-mono text-caption text-(--color-fg-faint)">
                  {display.prefix}
                </span>
              )}
              <span className="min-w-0 flex-1 truncate">{display.label}</span>
              <button
                type="button"
                tabIndex={-1}
                aria-label={`Close ${display.label}`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className={cn(
                  "inline-flex size-4.5 shrink-0 items-center justify-center rounded-md text-muted-foreground",
                  "hover:bg-accent hover:text-foreground",
                  selected || draft ? "visible" : "invisible group-hover:visible",
                )}
              >
                {draft && (
                  <span
                    aria-hidden
                    data-draft-dot
                    className="size-1.5 rounded-full bg-(--color-warning) group-hover:hidden"
                  />
                )}
                <X className={cn("size-3", draft && "hidden group-hover:block")} />
              </button>
            </div>
          </TooltipTrigger>
        </ContextMenuTrigger>
        <TooltipContent side="bottom" align="start">
          {display.repo && (
            <span className="font-mono">
              {display.repo}
              {display.prefix && ` ${display.prefix}`}
            </span>
          )}
          {display.repo && " · "}
          {display.title}
          {draft && " · Unsent draft"}
        </TooltipContent>
      </Tooltip>
      <ContextMenuContent className="w-56">
        <DockingMenu source={{ type: "tab", tabId: tab.id }} />
        <ContextMenuItem onSelect={() => closeTab(tab.id)}>
          Close tab
          {selected && focused && <ContextMenuShortcut>Alt W</ContextMenuShortcut>}
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => closeOtherTabs(tab.id)}>Close other tabs</ContextMenuItem>
        <ContextMenuItem disabled={isLast} onSelect={() => closeTabsToRight(tab.id)}>
          Close tabs to the right
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => duplicateTab(tab.id)}>Duplicate tab</ContextMenuItem>
        <ContextMenuItem
          onSelect={() =>
            void navigator.clipboard?.writeText(`${window.location.origin}${tab.href}`)
          }
        >
          Copy link
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem disabled={!hasClosed} onSelect={reopenClosedTab}>
          Reopen closed tab
          <ContextMenuShortcut>Alt ⇧ T</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
});

// ─── Display metadata ──────────────────────────────────────────────────────

type Tone = "none" | "open" | "merged" | "closed" | "done" | "draft";

type TabDisplay = {
  icon: TabMeta["icon"];
  tone: Tone;
  label: string;
  /** Mono identifier shown before the label, e.g. "#586". */
  prefix?: string;
  /** Full description for the tooltip. */
  title: string;
  repo?: string;
};

function useTabDisplay(href: string): TabDisplay {
  const pathname = hrefPathname(href);
  const meta = getTabMeta(pathname);
  const entity = useCachedEntity(pathname);
  const base = { icon: meta.icon, tone: "none" as Tone, repo: meta.sublabel };

  const num = /\/(?:pull|pr|review|issues)\/(\d+)/.exec(pathname)?.[1];
  if (num && entity) {
    return {
      ...base,
      tone: entity.tone,
      label: entity.title,
      prefix: `#${num}`,
      title: entity.title,
    };
  }

  // Code view: show the open file or folder instead of the generic "Code".
  if (pathname.endsWith("/code")) {
    const path = new URLSearchParams(href.split("?")[1]?.split("#")[0]).get("path");
    if (path) return { ...base, label: path.split("/").pop()!, title: path };
  }

  return { ...base, label: meta.label, title: meta.label };
}

type EntityRow = {
  number?: number;
  title?: string;
  state?: string;
  draft?: boolean;
  merged?: boolean;
  merged_at?: string | null;
  pull_request?: { merged_at?: string | null } | null;
};

/**
 * Title + state of a PR/issue from the query cache — the detail query if the
 * page was opened, else any list page that contained it.
 *
 * The cache is in memory only, so the last value seen is remembered across
 * reloads (see stores/tabTitles) and used until the cache has it again. Only
 * a tab never seen before, with nothing cached or remembered, fetches its
 * detail once.
 */
function useCachedEntity(pathname: string): { title: string; tone: Tone } | null {
  const queryClient = useQueryClient();
  const m = /^\/([^/]+)\/([^/]+)\/(pull|pr|review|issues)\/(\d+)/.exec(pathname);
  const key = m ? `${m[1]}/${m[2]}/${m[3] === "issues" ? "issue" : "pull"}/${m[4]}` : "";
  const remembered = useTabTitlesStore((s) => (key ? s.entries[key] : undefined));

  // Snapshot is a primitive so useSyncExternalStore can compare it cheaply.
  const snapshot = useSyncExternalStore(
    (cb) => queryClient.getQueryCache().subscribe(cb),
    () => {
      if (!m) return "";
      const [, owner, repo, kind, num] = m as unknown as [string, string, string, string, string];
      const n = Number(num);
      const isIssue = kind === "issues";
      let row = queryClient.getQueryData<EntityRow>(
        isIssue ? issueKeys.detail(owner, repo, n) : pullsKeys.detail(owner, repo, n),
      );
      if (!row?.title) {
        const lists = queryClient.getQueriesData({
          queryKey: isIssue ? issueKeys.all(owner, repo) : pullsKeys.lists(owner, repo),
        });
        for (const [, data] of lists) {
          row = findByNumber(data, n);
          if (row) break;
        }
      }
      if (!row?.title) return "";
      return `${toneOf(row, isIssue)}\u0000${row.title}`;
    },
  );

  const value = snapshot || remembered;
  const signedIn = useAuthStore((s) => !!s.token);

  useEffect(() => {
    if (key && snapshot) useTabTitlesStore.getState().remember(key, snapshot);
  }, [key, snapshot]);

  const fetchKey = key && !value && signedIn ? key : "";
  useEffect(() => {
    if (!fetchKey) return;
    const [owner = "", repo = "", kind, num] = fetchKey.split("/");
    if (kind === "issue") {
      void queryClient.prefetchQuery(issueDetailQueryOptions(owner, repo, Number(num)));
    } else {
      void queryClient.prefetchQuery(prDetailQueryOptions(owner, repo, Number(num)));
    }
  }, [fetchKey, queryClient]);

  if (!value) return null;
  const [tone, title] = value.split("\u0000") as [Tone, string];
  return { tone, title };
}

function toneOf(row: EntityRow, isIssue: boolean): Tone {
  if (isIssue) return row.state === "closed" ? "done" : "open";
  if (row.merged || row.merged_at || row.pull_request?.merged_at) return "merged";
  if (row.state === "closed") return "closed";
  return row.draft ? "draft" : "open";
}

/** Walk array or infinite-query list data for a row with this number. */
function findByNumber(data: unknown, n: number): EntityRow | undefined {
  const pages = (data as { pages?: unknown[] } | undefined)?.pages ?? [data];
  for (const page of pages) {
    if (!Array.isArray(page)) continue;
    const row = (page as EntityRow[]).find((x) => x?.number === n);
    if (row?.title) return row;
  }
  return undefined;
}
