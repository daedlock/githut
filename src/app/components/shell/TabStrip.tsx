import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { horizontalListSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { type KeyboardEvent, memo, useEffect, useRef, useSyncExternalStore } from "react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/app/components/ui/context-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/app/components/ui/tooltip";
import { issueDetailQueryOptions, issueKeys } from "@/app/features/issues/hooks";
import { prDetailQueryOptions, pullsKeys } from "@/app/features/pulls/hooks";
import { cn } from "@/app/lib/cn";
import {
  activateTab,
  closeOtherTabs,
  closeTabById,
  closeTabsToRight,
  duplicateTab,
  reopenClosedTab,
  reorderTabs,
} from "@/app/lib/tabActions";
import { getTabMeta, type TabMeta } from "@/app/lib/tabMeta";
import { useAuthStore } from "@/app/stores/auth";
import { hrefPathname, type Tab, useTabsStore } from "@/app/stores/tabs";
import { useTabTitlesStore } from "@/app/stores/tabTitles";

// ─── TabStrip ──────────────────────────────────────────────────────────────
//
// Editor-style tab bar (VS Code / Zed): flush, full-height tabs separated by
// hairlines on a raised frame. The active tab is lifted onto the page surface
// — it breaks the frame's bottom edge and carries a brand accent on top — so
// it reads as the front sheet the content below belongs to.
//
// Interaction is immediate: tabs activate on pointerdown, nothing animates.
//   click → switch · middle-click / × → close · drag → reorder
//   right-click → close / close others / close to the right / duplicate / …

export function TabStrip() {
  const tabs = useTabsStore((s) => s.tabs);
  const activeId = useTabsStore((s) => s.activeId);
  const scroller = useRef<HTMLDivElement>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

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

  useEffect(() => {
    if (!activeId) return;
    scroller.current
      ?.querySelector<HTMLElement>(`[data-tab-id="${activeId}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeId]);

  const repos = new Set(tabs.map((t) => getTabMeta(hrefPathname(t.href)).sublabel ?? ""));
  const showRepo = repos.size > 1;

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    reorderTabs(
      tabs.findIndex((t) => t.id === active.id),
      tabs.findIndex((t) => t.id === over.id),
    );
  }

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
      data-tab-strip
      data-link-menu="off"
      className="flex h-9 shrink-0 select-none items-stretch bg-muted shadow-[inset_0_-1px_0_var(--color-border)]"
    >
      <TooltipProvider delayDuration={700} skipDelayDuration={300}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={tabs.map((t) => t.id)} strategy={horizontalListSortingStrategy}>
            <div
              ref={scroller}
              role="tablist"
              aria-label="Open tabs"
              onKeyDown={onKeyDown}
              className="flex min-w-0 flex-1 items-stretch overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {tabs.map((tab, i) => (
                <TabItem
                  key={tab.id}
                  tab={tab}
                  active={tab.id === activeId}
                  isLast={i === tabs.length - 1}
                  showRepo={showRepo}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </TooltipProvider>
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
  active,
  isLast,
  showRepo,
}: {
  tab: Tab;
  active: boolean;
  isLast: boolean;
  showRepo: boolean;
}) {
  const display = useTabDisplay(tab.href);
  const hasClosed = useTabsStore((s) => s.closed.length > 0);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tab.id,
  });
  const Icon = display.icon;
  const repoName = display.repo?.split("/")[1];

  return (
    <ContextMenu>
      <Tooltip>
        <ContextMenuTrigger asChild>
          <TooltipTrigger asChild>
            <div
              ref={setNodeRef}
              {...attributes}
              {...listeners}
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              data-tab-id={tab.id}
              onPointerDown={(e) => {
                if (e.button === 0) activateTab(tab.id);
                listeners?.onPointerDown?.(e);
              }}
              onMouseDown={(e) => e.button === 1 && e.preventDefault()}
              onAuxClick={(e) => e.button === 1 && closeTabById(tab.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  activateTab(tab.id);
                } else if (e.key === "Delete") {
                  closeTabById(tab.id);
                }
              }}
              style={{
                transform: CSS.Translate.toString(transform && { ...transform, y: 0 }),
                transition: isDragging ? undefined : transition,
              }}
              className={cn(
                "group relative flex min-w-28 max-w-60 shrink cursor-default items-center gap-2 pl-3 pr-1.5",
                "border-r border-border text-ui outline-none",
                "focus-visible:shadow-[inset_0_0_0_1px_var(--color-focus)]",
                active
                  ? [
                      "z-10 bg-background text-foreground",
                      // Left hairline lands on the neighbour's separator; the soft
                      // lift keeps the front sheet distinct from the frame.
                      "shadow-[-1px_0_0_var(--color-border),0_-6px_14px_-8px_color-mix(in_oklab,black_35%,transparent)]",
                    ]
                  : "text-muted-foreground hover:bg-[color-mix(in_oklab,var(--color-bg-sunken)_55%,transparent)] hover:text-foreground",
                isDragging &&
                  "z-20 bg-background text-foreground shadow-[0_4px_16px_color-mix(in_oklab,black_30%,transparent)]",
              )}
            >
              {active && <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-primary" />}
              <Icon aria-hidden className={cn("size-4 shrink-0", TONE_CLASS[display.tone])} />
              <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
                {display.prefix && (
                  <span className="shrink-0 font-mono text-caption text-(--color-fg-faint)">
                    {display.prefix}
                  </span>
                )}
                <span className="min-w-0 truncate">{display.label}</span>
                {showRepo && repoName && (
                  <span className="min-w-0 max-w-24 shrink-[3] truncate text-caption text-(--color-fg-faint)">
                    {repoName}
                  </span>
                )}
              </span>
              <button
                type="button"
                tabIndex={-1}
                aria-label={`Close ${display.label}`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  closeTabById(tab.id);
                }}
                className={cn(
                  "inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground",
                  "hover:bg-(--color-bg-sunken) hover:text-foreground",
                  active ? "visible" : "invisible group-hover:visible",
                )}
              >
                <X className="size-3.5" />
              </button>
            </div>
          </TooltipTrigger>
        </ContextMenuTrigger>
        {!isDragging && (
          <TooltipContent side="bottom" align="start" className="flex flex-col items-start gap-0.5">
            <span className="text-caption">{display.title}</span>
            {display.repo && (
              <span className="font-mono text-micro opacity-70">{display.repo}</span>
            )}
          </TooltipContent>
        )}
      </Tooltip>
      <ContextMenuContent className="w-56">
        <ContextMenuItem onSelect={() => closeTabById(tab.id)}>
          Close tab
          {active && <ContextMenuShortcut>Alt W</ContextMenuShortcut>}
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
      title: `${meta.label} · ${entity.title}`,
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
