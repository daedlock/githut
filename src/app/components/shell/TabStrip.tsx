import { Check, ChevronDown, Pin, PinOff, X } from "lucide-react";
import { type KeyboardEvent, memo, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { DockingMenu } from "@/app/components/shell/DockingMenu";
import { RepoMark } from "@/app/components/shell/RepoMark";
import { TabHint } from "@/app/components/shell/TabHint";
import { Button } from "@/app/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/app/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import { pageEntity } from "@/app/features/activity/api";
import { useTabActivityStore } from "@/app/features/activity/store";
import { pageIsUnread } from "@/app/features/activity/watcher";
import { issueKeys } from "@/app/features/issues/hooks";
import { useNotificationState } from "@/app/features/notifications/service";
import { pullsKeys } from "@/app/features/pulls/hooks";
import { usePageHasDraft } from "@/app/hooks/usePageHasDraft";
import { cn } from "@/app/lib/cn";
import { queryClient as workspaceQueryClient } from "@/app/lib/query";
import {
  closeOtherTabs,
  closeTab,
  closeTabsToRight,
  duplicateTab,
  pinTab,
  reopenClosedTab,
  selectTab,
} from "@/app/lib/tabActions";
import { getTabMeta, type TabMeta } from "@/app/lib/tabMeta";
import { useTabTitlesStore } from "@/app/stores/tabTitles";
import { useWorkspaceView } from "@/app/stores/workspaceView";
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
  const narrow = useWorkspaceView((state) => state.narrow);
  const [overflowing, setOverflowing] = useState(false);

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
    // The island can resize and the selected title can arrive late: re-check
    // on those only. Other tabs resizing (titles, unread dots) must not undo
    // the user's own scroll of the strip.
    const ro = new ResizeObserver(reveal);
    ro.observe(strip);
    ro.observe(sel);
    return () => ro.disconnect();
  }, [selectedTabId]);

  // The "all tabs" chevron only appears when the strip actually overflows.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-observe when the tab elements change
  useEffect(() => {
    const strip = scroller.current;
    if (!strip) return;
    const measure = () => setOverflowing(strip.scrollWidth > strip.clientWidth + 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(strip);
    for (const item of strip.querySelectorAll<HTMLElement>("[data-tab-id]")) ro.observe(item);
    return () => ro.disconnect();
  }, [tabs]);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const items = [...e.currentTarget.querySelectorAll<HTMLElement>("[role=tab]")];
    const idx = items.indexOf(document.activeElement as HTMLElement);
    if (idx === -1) return;
    e.preventDefault();
    items[(idx + (e.key === "ArrowRight" ? 1 : -1) + items.length) % items.length]?.focus();
  }

  return (
    <>
      <TabHint focused={focused}>
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
              pinned={island.pinned.includes(tab.id)}
              isLast={i === tabs.length - 1}
            />
          ))}
        </div>
      </TabHint>
      {/* In narrow mode the island switcher lists every tab instead. */}
      {overflowing && !narrow && <TabOverflow island={island} />}
    </>
  );
}

function TabOverflow({ island }: { island: Island }) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Show all tabs" className="shrink-0">
              <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">Show all tabs</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuGroup>
          {island.tabs.map((tab) => (
            <OverflowTab
              key={tab.id}
              tab={tab}
              selected={tab.id === island.selectedTabId}
              pinned={island.pinned.includes(tab.id)}
            />
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function OverflowTab({ tab, selected, pinned }: { tab: Tab; selected: boolean; pinned: boolean }) {
  const display = useTabDisplay(tab.href);
  const Icon = display.icon;
  return (
    <DropdownMenuItem
      onSelect={() => selectTab(tab.id)}
      aria-current={selected ? "page" : undefined}
      aria-label={`${display.prefix ?? ""} ${display.label}${display.status ? `, ${display.status}` : ""}${display.unread ? ", unread" : ""}`}
    >
      {display.repo && <RepoMark repo={display.repo} size="sm" />}
      <Icon className={TONE_CLASS[display.tone]} />
      <span className="min-w-0 flex-1 truncate">
        {display.prefix && `${display.prefix} `}
        {display.label}
      </span>
      {pinned && <Pin aria-label="Pinned" />}
      {display.unread && <UnreadDot />}
      {selected && <Check aria-label="Selected" />}
    </DropdownMenuItem>
  );
}

// ─── Tab ───────────────────────────────────────────────────────────────────

export const TONE_CLASS: Record<Tone, string> = {
  none: "text-muted-foreground",
  open: "text-(--color-success)",
  merged: "text-(--color-pr-merged)",
  closed: "text-(--color-danger)",
  done: "text-(--color-pr-merged)",
  draft: "text-(--color-fg-faint)",
  running: "text-(--color-warning)",
  failed: "text-(--color-danger)",
};

export function UnreadDot({ pinned = false }: { pinned?: boolean }) {
  return (
    <span
      aria-hidden
      data-unread-dot
      className={cn(
        "size-1.5 shrink-0 rounded-full bg-(--color-brand)",
        pinned && "absolute bottom-0.5 right-0.5",
      )}
    />
  );
}

const TabItem = memo(function TabItem({
  tab,
  selected,
  focused,
  pinned,
  isLast,
}: {
  tab: Tab;
  selected: boolean;
  focused: boolean;
  pinned: boolean;
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
              aria-label={`${display.prefix ? `${display.prefix} ` : ""}${display.label}${display.status ? `, ${display.status}` : ""}${display.unread ? ", unread" : ""}${pinned ? ", pinned" : ""}${draft ? ", unsent draft" : ""}`}
              tabIndex={selected ? 0 : -1}
              data-tab-id={tab.id}
              data-pinned={pinned || undefined}
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
                "group relative flex h-7 shrink-0 cursor-default items-center gap-1.5 rounded-lg",
                pinned ? "px-2" : "min-w-16 max-w-[220px] pl-2 pr-1",
                "text-ui outline-none focus-visible:ring-1 focus-visible:ring-(--color-focus)",
                !selected && "text-muted-foreground hover:bg-accent hover:text-foreground",
                selected && !focused && "bg-muted text-foreground ring-1 ring-border",
                selected &&
                  focused && [
                    "bg-[color-mix(in_oklab,var(--color-brand)_9%,var(--color-bg-subtle))] text-foreground",
                    "ring-1 ring-[color:color-mix(in_oklab,var(--color-brand)_45%,var(--color-border))]",
                  ],
              )}
            >
              {display.repo && <RepoMark repo={display.repo} size="sm" />}
              <Icon
                aria-hidden
                data-tab-status={display.tone}
                className={cn("size-3.5 shrink-0", TONE_CLASS[display.tone])}
              />
              {!pinned && display.prefix && (
                <span className="shrink-0 font-mono text-caption text-(--color-fg-faint)">
                  {display.prefix}
                </span>
              )}
              {!pinned && <span className="min-w-0 flex-1 truncate">{display.label}</span>}
              {display.unread && <UnreadDot pinned={pinned} />}
              {pinned && draft && (
                <span
                  aria-hidden
                  data-draft-dot
                  className="absolute right-0.5 top-0.5 size-1.5 rounded-full bg-(--color-warning)"
                />
              )}
              {!pinned && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  tabIndex={-1}
                  aria-label={`Close ${display.label}`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className={cn(
                    "size-4.5 rounded-md hover:bg-accent active:not-aria-[haspopup]:translate-y-0",
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
                </Button>
              )}
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
          {display.status && ` · ${display.status}`}
          {display.unread && " · Unread activity"}
          {draft && " · Unsent draft"}
        </TooltipContent>
      </Tooltip>
      <ContextMenuContent className="w-56">
        <DockingMenu source={{ type: "tab", tabId: tab.id }} />
        <ContextMenuGroup>
          <ContextMenuItem onSelect={() => pinTab(tab.id, !pinned)}>
            {pinned ? <PinOff /> : <Pin />}
            {pinned ? "Unpin tab" : "Pin tab"}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => closeTab(tab.id)}>
            Close tab
            {selected && focused && <ContextMenuShortcut>Alt W</ContextMenuShortcut>}
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => closeOtherTabs(tab.id)}>
            Close other tabs
          </ContextMenuItem>
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
        </ContextMenuGroup>
      </ContextMenuContent>
    </ContextMenu>
  );
});

// ─── Display metadata ──────────────────────────────────────────────────────

type Tone = "none" | "open" | "merged" | "closed" | "done" | "draft" | "running" | "failed";

type TabDisplay = {
  icon: TabMeta["icon"];
  tone: Tone;
  label: string;
  /** Mono identifier shown before the label, e.g. "#586". */
  prefix?: string;
  /** Full description for the tooltip. */
  title: string;
  repo?: string;
  unread: boolean;
  status?: string;
};

// ─── Shared display sources ──
//
// Every tab label, overflow row and switcher row reads the same three sources.
// They share one subscription to each (not one per label), bursts of cache
// events collapse into one notification per microtask, and each derived
// snapshot is computed once per change per page rather than once per reader.

const listeners = new Set<() => void>();
let version = 0;
let stopSources: (() => void) | null = null;
let scheduled = false;

function bump() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    version++;
    for (const listener of listeners) listener();
  });
}

function subscribeDisplaySources(listener: () => void) {
  listeners.add(listener);
  if (!stopSources) {
    version++;
    const stops = [
      useTabActivityStore.subscribe(bump),
      useNotificationState.subscribe(bump),
      workspaceQueryClient.getQueryCache().subscribe(bump),
    ];
    stopSources = () => {
      for (const stop of stops) stop();
    };
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      stopSources?.();
      stopSources = null;
    }
  };
}

/** Memoizes `compute` per key for the current source version. */
function versioned<T>(compute: (key: string) => T) {
  const cache = new Map<string, { version: number; value: T }>();
  return (key: string): T => {
    const hit = cache.get(key);
    // Without a live subscription the version can't be trusted: recompute.
    if (hit && hit.version === version && stopSources) return hit.value;
    const value = compute(key);
    cache.set(key, { version, value });
    if (cache.size > 500) cache.clear();
    return value;
  };
}

const unreadSnapshot = versioned((href) => pageIsUnread(href));

export function useTabDisplay(href: string): TabDisplay {
  const pathname = hrefPathname(href);
  const meta = getTabMeta(pathname);
  const entity = useCachedEntity(pathname);
  const unread = useSyncExternalStore(subscribeDisplaySources, () => unreadSnapshot(href));
  const base = { icon: meta.icon, tone: "none" as Tone, repo: meta.sublabel, unread };

  const num = /\/(?:pull|pr|review|issues)\/(\d+)/.exec(pathname)?.[1];
  if (num && entity) {
    return {
      ...base,
      tone: entity.tone,
      label: entity.title,
      prefix: `#${num}`,
      title: entity.title,
      status:
        entity.tone === "failed"
          ? "CI failed"
          : entity.tone === "running"
            ? "CI running"
            : undefined,
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
 * reloads (see stores/tabTitles). Background status belongs to the lightweight
 * watcher, never an eager detail prefetch from a tab label.
 */
const ENTITY_PATH = /^\/([^/]+)\/([^/]+)\/(pull|pr|review|issues)\/(\d+)/;

function useCachedEntity(pathname: string): { title: string; tone: Tone } | null {
  const m = ENTITY_PATH.exec(pathname);
  const key = m ? `${m[1]}/${m[2]}/${m[3] === "issues" ? "issue" : "pull"}/${m[4]}` : "";
  const remembered = useTabTitlesStore((s) => (key ? s.entries[key] : undefined));

  // Snapshot is a primitive so useSyncExternalStore can compare it cheaply.
  const snapshot = useSyncExternalStore(subscribeDisplaySources, () => entitySnapshot(pathname));

  const value = snapshot || remembered;

  useEffect(() => {
    if (key && snapshot) useTabTitlesStore.getState().remember(key, snapshot);
  }, [key, snapshot]);

  if (!value) return null;
  const [tone, title] = value.split("\u0000") as [Tone, string];
  return { tone, title };
}

const entitySnapshot = versioned((pathname): string => {
  const queryClient = workspaceQueryClient;
  const m = ENTITY_PATH.exec(pathname);
  const page = pageEntity(pathname);
  if (!m) return "";
  const [, owner, repo, kind, num] = m as unknown as [string, string, string, string, string];
  const n = Number(num);
  const isIssue = kind === "issues";
  const detail = queryClient.getQueryState<EntityRow>(
    isIssue ? issueKeys.detail(owner, repo, n) : pullsKeys.detail(owner, repo, n),
  );
  let row = detail?.data;
  let updatedAt = detail?.dataUpdatedAt ?? 0;
  if (!row?.title) {
    const lists = queryClient.getQueryCache().findAll({
      queryKey: isIssue ? issueKeys.all(owner, repo) : pullsKeys.lists(owner, repo),
    });
    for (const query of lists) {
      const candidate = findByNumber(query.state.data, n);
      if (candidate?.title && query.state.dataUpdatedAt >= updatedAt) {
        row = candidate;
        updatedAt = query.state.dataUpdatedAt;
      }
    }
  }
  const watched = page ? useTabActivityStore.getState().statuses[page.key] : undefined;
  const useWatched = watched && (!row?.title || watched.observedAt >= updatedAt);
  const title = useWatched ? watched.title : row?.title;
  if (!title) return "";
  let tone = useWatched ? watched.state : toneOf(row!, isIssue);
  if (!isIssue && (tone === "open" || tone === "draft")) {
    const rollup = queryClient.getQueryState<{ state: string } | null>(
      pullsKeys.checkRollup(owner, repo, n),
    );
    const ci =
      watched && watched.observedAt >= (rollup?.dataUpdatedAt ?? 0)
        ? watched.ci
        : rollup?.data?.state === "failure"
          ? "failed"
          : rollup?.data?.state === "pending"
            ? "running"
            : null;
    if (ci === "failed" || ci === "running") tone = ci;
  }
  return `${tone}\u0000${title}`;
});

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
