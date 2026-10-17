import { GitPullRequest, History, Inbox, Search, Star } from "lucide-react";
import {
  type PointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { DockingMenu } from "@/app/components/shell/DockingMenu";
import { RepoMark } from "@/app/components/shell/RepoMark";
import type { useDocking } from "@/app/components/shell/useDocking";
import { Button } from "@/app/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/app/components/ui/context-menu";
import { Input } from "@/app/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import {
  type DashboardItem,
  useMyOpenPrs,
  useReviewRequestedPrs,
} from "@/app/features/dashboard/hooks";
import { useToggleStar } from "@/app/hooks/useRepoStarred";
import { useStableList } from "@/app/hooks/useStableList";
import { useStarredRepos } from "@/app/hooks/useStarredRepos";
import { cn } from "@/app/lib/cn";
import { useCanMutate } from "@/app/lib/connectivity";
import {
  getRecentItemsSync,
  hydrateRecentItems,
  subscribeRecentItems,
} from "@/app/lib/recentItems";
import { focusPaneOfFocusedTab, openInNewTab, openOrJump, openToSide } from "@/app/lib/tabActions";
import { getTabMeta, tabRepo } from "@/app/lib/tabMeta";
import { SIDEBAR_RAIL_WIDTH, useSidebarStore } from "@/app/stores/sidebar";
import { focusedTab, hrefPathname, islands } from "@/app/workspace/model";
import { useWorkspaceStore } from "@/app/workspace/store";

type BeginDrag = ReturnType<typeof useDocking>["beginDrag"];
type Row = {
  href: string;
  label: string;
  repo?: string;
  meta?: string;
  starred?: boolean;
  icon?: typeof Inbox;
};

export function Sidebar({ beginDrag }: { beginDrag: BeginDrag }) {
  const { width, collapsed, resize, reset } = useSidebarStore();
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), []);

  function startResize(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    cleanup.current?.();
    const target = event.currentTarget;
    const start = event.clientX;
    const initial = collapsed ? SIDEBAR_RAIL_WIDTH : width;
    const before = { width, collapsed };
    target.setPointerCapture(event.pointerId);
    target.focus({ preventScroll: true });
    const move = (next: globalThis.PointerEvent) => resize(initial + next.clientX - start);
    const end = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", end);
      target.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", key);
      if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
      cleanup.current = null;
    };
    const cancel = () => {
      useSidebarStore.setState(before);
      end();
    };
    const key = (next: KeyboardEvent) => {
      if (next.key === "Escape") {
        next.preventDefault();
        cancel();
      }
    };
    cleanup.current = cancel;
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", end);
    target.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", key);
  }

  return (
    <aside
      id="workspace-sidebar"
      aria-label="Sidebar"
      data-sidebar-collapsed={collapsed}
      style={{ width: collapsed ? SIDEBAR_RAIL_WIDTH : width }}
      className="relative mr-2 min-h-0 shrink-0"
    >
      <SidebarContent collapsed={collapsed} beginDrag={beginDrag} />
      {/* biome-ignore lint/a11y/useSemanticElements: a keyboard-operable window splitter */}
      <div
        role="separator"
        tabIndex={0}
        aria-label="Resize sidebar"
        aria-orientation="vertical"
        aria-valuemin={SIDEBAR_RAIL_WIDTH}
        aria-valuemax={360}
        aria-valuenow={collapsed ? SIDEBAR_RAIL_WIDTH : width}
        onPointerDown={startResize}
        onDoubleClick={reset}
        onKeyDown={(event) => {
          if (event.key === "Home") resize(0);
          else if (event.key === "End") resize(360);
          else if (event.key === "ArrowLeft")
            resize((collapsed ? SIDEBAR_RAIL_WIDTH : width) - (event.shiftKey ? 64 : 16));
          else if (event.key === "ArrowRight")
            resize((collapsed ? 200 : width) + (event.shiftKey ? 64 : 16));
          else return;
          event.preventDefault();
        }}
        className="group absolute inset-y-0 -right-2 w-2 cursor-col-resize touch-none outline-none"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-3 left-1/2 w-0.5 rounded-full bg-primary opacity-0 group-hover:opacity-90 group-focus-visible:opacity-90"
        />
      </div>
    </aside>
  );
}

/** The drawer uses the same content and launch behavior as the desktop sidebar. */
export function SidebarContent({
  collapsed = false,
  beginDrag,
  onLaunch,
}: {
  collapsed?: boolean;
  beginDrag?: BeginDrag;
  onLaunch?: () => void;
}) {
  const [filter, setFilter] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const workspace = useWorkspaceStore((state) => state.workspace);
  const recent = useSyncExternalStore(subscribeRecentItems, getRecentItemsSync);
  const stars = useStarredRepos();
  const reviews = useReviewRequestedPrs();
  const authored = useMyOpenPrs();
  useEffect(() => {
    void hydrateRecentItems().catch(() => {});
  }, []);
  const openTabs = islands(workspace.layout).flatMap((island) => island.tabs);
  const openHrefs = new Set(openTabs.map((tab) => tab.href));
  const openRepos = new Set(
    openTabs.map((tab) => tabRepo(hrefPathname(tab.href))?.toLowerCase()).filter(Boolean),
  );
  const focusedRepo = tabRepo(hrefPathname(focusedTab(workspace).href))?.toLowerCase();
  const lastUsed = new Map<string, number>();
  for (const item of recent) {
    const repo = tabRepo(hrefPathname(item.href));
    if (repo)
      lastUsed.set(
        repo.toLowerCase(),
        Math.max(lastUsed.get(repo.toLowerCase()) ?? 0, item.visitedAt),
      );
  }
  const matches = (row: Row) =>
    `${row.label} ${row.repo ?? ""} ${row.meta ?? ""}`
      .toLowerCase()
      .includes(filter.trim().toLowerCase());
  const yourWork = [
    ...(reviews.data ?? [])
      .map((item) => prRow(item, "Review requested"))
      .filter(matches)
      .slice(0, 5),
    ...(authored.data ?? [])
      .filter((item) => !reviews.data?.some((review) => review.id === item.id))
      .map((item) => prRow(item, "Your pull request"))
      .filter(matches)
      .slice(0, 5),
  ];
  const fallback = stars.isSuccess && stars.data.length === 0;
  const starred: Row[] = fallback
    ? [...lastUsed.keys()]
        .sort((a, b) => (lastUsed.get(b) ?? 0) - (lastUsed.get(a) ?? 0))
        .map((repo) => ({
          href: `/${repo}/code`,
          label: repo.split("/")[1]!,
          repo,
          starred: false,
        }))
    : [...(stars.data ?? [])]
        .sort(
          (a, b) =>
            (lastUsed.get(b.full_name.toLowerCase()) ?? 0) -
            (lastUsed.get(a.full_name.toLowerCase()) ?? 0),
        )
        .map((repo) => ({
          href: `/${repo.full_name}/code`,
          label: repo.name,
          repo: repo.full_name,
          starred: true,
        }));
  const filteredStars = starred.filter(matches);
  const recentRows: Row[] = [...recent]
    .sort((a, b) => b.visitedAt - a.visitedAt)
    .filter((item) => !openHrefs.has(item.href))
    .map((item) => ({
      href: item.href,
      label: item.label,
      repo: tabRepo(hrefPathname(item.href)) ?? undefined,
      meta: item.meta,
      icon: getTabMeta(hrefPathname(item.href)).icon,
    }))
    .filter(matches)
    .slice(0, 5);
  const renderRow = (row: Row) => (
    <SidebarRow
      key={row.href}
      row={row}
      collapsed={collapsed}
      beginDrag={beginDrag}
      onLaunch={onLaunch}
      onMutationError={setMutationError}
      active={
        row.starred !== undefined
          ? row.repo?.toLowerCase() === focusedRepo
          : row.href === focusedTab(workspace).href
      }
      open={!!row.repo && openRepos.has(row.repo.toLowerCase())}
    />
  );
  const workList = useStableList(yourWork, { key: (row) => row.href, resetKey: filter });
  const starList = useStableList(filteredStars, { key: (row) => row.href, resetKey: filter });
  const recentList = useStableList(recentRows, { key: (row) => row.href, resetKey: filter });
  return (
    <nav
      aria-label="Workspace navigation"
      data-link-menu="off"
      className="flex h-full min-h-0 flex-col gap-5 overflow-y-auto overflow-x-hidden pr-2 pb-3"
    >
      <div className="flex flex-col gap-1">
        <div className="flex h-8 items-center">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Filter sidebar"
                  onClick={() => {
                    useSidebarStore.getState().toggle();
                    requestAnimationFrame(() => input.current?.focus());
                  }}
                >
                  <Search />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Filter sidebar</TooltipContent>
            </Tooltip>
          ) : (
            <Input
              ref={input}
              aria-label="Filter sidebar"
              placeholder="Filter repos and PRs…"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
          )}
        </div>
        {renderRow({ href: "/", label: "Inbox", icon: Inbox })}
      </div>
      {workList.items.length > 0 && (
        <SidebarSection
          title="Your work"
          icon={GitPullRequest}
          collapsed={collapsed}
          listProps={workList.listProps}
        >
          {workList.items.map(renderRow)}
        </SidebarSection>
      )}
      {starList.items.length > 0 && (
        <SidebarSection
          title="Starred"
          icon={Star}
          collapsed={collapsed}
          listProps={starList.listProps}
        >
          {starList.items.slice(0, showAll || filter.trim() ? undefined : 8).map(renderRow)}
          {fallback && !collapsed && (
            <p className="px-2 text-caption text-muted-foreground">
              Recently used repos. Star repos on GitHub to keep them here.
            </p>
          )}
          {filteredStars.length > 8 && !filter.trim() && (
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={showAll}
              className={cn("justify-start", collapsed && "invisible")}
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? "Show less" : "Show all"}
            </Button>
          )}
        </SidebarSection>
      )}
      {recentList.items.length > 0 && (
        <SidebarSection
          title="Recent"
          icon={History}
          collapsed={collapsed}
          listProps={recentList.listProps}
        >
          {recentList.items.map(renderRow)}
        </SidebarSection>
      )}
      {mutationError && (
        <p
          role="alert"
          className={cn("px-2 text-caption text-destructive", collapsed && "sr-only")}
        >
          {mutationError}
        </p>
      )}
      {!collapsed &&
        filter.trim() &&
        !yourWork.length &&
        !filteredStars.length &&
        !recentRows.length && (
          <p role="status" className="px-2 text-caption text-muted-foreground">
            No matching repos or pages.
          </p>
        )}
      {!collapsed && (stars.isError || reviews.isError || authored.isError) && (
        <p role="status" className="px-2 text-caption text-muted-foreground">
          Some sidebar items could not be loaded.
        </p>
      )}
    </nav>
  );
}

function SidebarSection({
  title,
  icon: Icon,
  collapsed,
  children,
  listProps,
}: {
  title: string;
  icon: typeof Inbox;
  collapsed: boolean;
  children: ReactNode;
  listProps: ReturnType<typeof useStableList>["listProps"];
}) {
  return (
    <section {...listProps} aria-label={title} className="flex flex-col gap-0">
      <h2 className="flex h-6 shrink-0 items-center gap-2 px-2 text-micro font-medium uppercase tracking-widest text-muted-foreground">
        <Icon className="size-4 shrink-0" aria-hidden />
        <span className={cn("truncate", collapsed && "sr-only")}>{title}</span>
      </h2>
      {children}
    </section>
  );
}

function prRow(item: DashboardItem, reason: string): Row {
  const repo = `${item.ownerRepo.owner}/${item.ownerRepo.repo}`;
  return {
    href: `/${repo}/pull/${item.number}`,
    label: item.title,
    repo,
    meta: `${reason} · #${item.number}`,
    icon: GitPullRequest,
  };
}

function SidebarRow({
  row,
  collapsed,
  beginDrag,
  onLaunch,
  onMutationError,
  active,
  open,
}: {
  row: Row;
  collapsed: boolean;
  beginDrag?: BeginDrag;
  onLaunch?: () => void;
  onMutationError: (message: string | null) => void;
  active: boolean;
  open: boolean;
}) {
  const [owner = "", repo = ""] = row.repo?.split("/") ?? [];
  const unstar = useToggleStar(owner, repo);
  const { canMutate, reason } = useCanMutate();
  const navigation = useRef(false);
  const Icon = row.icon ?? Star;
  const launch = (action: () => void) => {
    navigation.current = true;
    action();
    onLaunch?.();
    focusPaneOfFocusedTab();
  };
  return (
    <ContextMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <ContextMenuTrigger asChild>
            <button
              type="button"
              data-sidebar-row
              data-sidebar-href={row.href}
              aria-label={row.label}
              aria-current={active ? "page" : undefined}
              onPointerDown={(event) =>
                beginDrag?.(event, { type: "href", href: row.href }, row.label)
              }
              onClick={(event) =>
                launch(() => (event.altKey ? openToSide(row.href) : openOrJump(row.href)))
              }
              className={cn(
                "flex h-8 w-full shrink-0 items-center gap-2 rounded-lg px-2 text-left text-ui outline-none hover:bg-muted focus-visible:ring-1 focus-visible:ring-foreground/15",
                active && "bg-accent hover:bg-accent",
              )}
            >
              {row.repo ? (
                <RepoMark repo={row.repo} />
              ) : (
                <Icon aria-hidden className="size-4 shrink-0" />
              )}
              {!collapsed && (
                <>
                  <span className="min-w-0 flex-1 truncate">{row.label}</span>
                  {row.starred !== undefined && open && (
                    <span
                      role="img"
                      aria-label="Has open tabs"
                      className="size-1 shrink-0 rounded-full bg-muted-foreground/60"
                    />
                  )}
                </>
              )}
            </button>
          </ContextMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="right">
          {row.label}
          {row.repo && <span className="ml-2 font-mono">{row.repo}</span>}
          {row.meta && <span className="ml-2">{row.meta}</span>}
        </TooltipContent>
      </Tooltip>
      <ContextMenuContent
        onCloseAutoFocus={(event) => {
          if (navigation.current) {
            event.preventDefault();
            navigation.current = false;
            focusPaneOfFocusedTab();
          }
        }}
      >
        <ContextMenuGroup>
          <ContextMenuItem onSelect={() => launch(() => openInNewTab(row.href))}>
            Open in new tab
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => launch(() => openToSide(row.href))}>
            Open to the side
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() =>
              void navigator.clipboard?.writeText(`${window.location.origin}${row.href}`)
            }
          >
            Copy link
          </ContextMenuItem>
        </ContextMenuGroup>
        <DockingMenu source={{ type: "href", href: row.href }} onDock={onLaunch} />
        {row.starred && (
          <ContextMenuGroup>
            <ContextMenuItem
              disabled={!canMutate || unstar.isPending}
              title={reason}
              onSelect={() => {
                onMutationError(null);
                // Optimistic removal unmounts this row. The content owns the
                // failure notice so it survives until GitHub responds.
                void unstar
                  .mutateAsync(false)
                  .catch(() => onMutationError(`Could not unstar ${row.label}. Try again.`));
              }}
            >
              Unstar
            </ContextMenuItem>
          </ContextMenuGroup>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
