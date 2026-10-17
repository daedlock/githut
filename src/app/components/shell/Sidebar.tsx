import { Building2, ChevronRight, FolderGit2, Inbox, Search, Star } from "lucide-react";
import { type PointerEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { DockingMenu } from "@/app/components/shell/DockingMenu";
import { RepoMark } from "@/app/components/shell/RepoMark";
import { SidebarControls } from "@/app/components/shell/SidebarControls";
import type { useDocking } from "@/app/components/shell/useDocking";
import { Button } from "@/app/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/app/components/ui/collapsible";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/app/components/ui/context-menu";
import { Empty, EmptyDescription } from "@/app/components/ui/empty";
import { Input } from "@/app/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import { useNotificationUnreadCount } from "@/app/features/notifications/service";
import {
  useOrganizationRepositories,
  useSidebarOrganizations,
  useYourRepositories,
} from "@/app/hooks/sidebarRepositories";
import { useStableList } from "@/app/hooks/useStableList";
import { cn } from "@/app/lib/cn";
import { focusPaneOfFocusedTab, openInNewTab, openOrJump, openToSide } from "@/app/lib/tabActions";
import { getTabMeta, tabRepo } from "@/app/lib/tabMeta";
import { useAuthStore } from "@/app/stores/auth";
import { type Favorite, favoriteId, useFavoritesStore } from "@/app/stores/favorites";
import { SIDEBAR_RAIL_WIDTH, useSidebarStore } from "@/app/stores/sidebar";
import { focusedTab, hrefPathname, islands } from "@/app/workspace/model";
import { useWorkspaceStore } from "@/app/workspace/store";

type BeginDrag = ReturnType<typeof useDocking>["beginDrag"];
type Row = {
  href: string;
  label: string;
  repo?: string;
  meta?: string;
  kind?: "repo" | "view";
  favorite?: Favorite;
  icon?: typeof Inbox;
  count?: number;
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
      className={cn("relative mr-2 flex min-h-0 shrink-0 flex-col", !collapsed && "px-2")}
    >
      <SidebarControls collapsed={collapsed} />
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
  const input = useRef<HTMLInputElement>(null);
  const unreadCount = useNotificationUnreadCount();
  const workspace = useWorkspaceStore((state) => state.workspace);
  const accountId = useAuthStore((state) => state.accountId);
  const favorites = useFavoritesStore((state) => state.forAccount(accountId));
  const [orgLimit, setOrgLimit] = useState(6);
  const repos = useYourRepositories();
  const orgs = useSidebarOrganizations();
  const current = focusedTab(workspace);
  const focusedRepo = tabRepo(hrefPathname(current.href));
  const openRepos = new Set(
    islands(workspace.layout)
      .flatMap((island) => island.tabs)
      .map((tab) => tabRepo(hrefPathname(tab.href))),
  );
  const renderRow = (row: Row) => (
    <SidebarRow
      key={row.favorite?.id ?? row.href}
      row={row}
      collapsed={collapsed}
      beginDrag={beginDrag}
      onLaunch={onLaunch}
      active={row.kind === "repo" ? row.repo === focusedRepo : row.href === current.href}
      open={!!row.repo && openRepos.has(row.repo)}
    />
  );
  const favoriteRows = favorites.map((item) => {
    const pathname = hrefPathname(item.href);
    const meta = getTabMeta(pathname);
    const repo = tabRepo(pathname);
    return {
      href: item.href,
      kind: item.kind,
      favorite: item,
      repo,
      label:
        item.kind === "repo"
          ? (repo?.split("/")[1] ?? meta.label)
          : repo
            ? `${repo.split("/")[1]} · ${meta.label}`
            : meta.label,
      icon: meta.icon,
    };
  });
  const currentFavorite = favoriteId({ kind: "view", href: current.href });
  const isCurrentFavorite = favorites.some((item) => item.id === currentFavorite);
  return (
    <nav
      aria-label="Workspace navigation"
      data-link-menu="off"
      className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overflow-x-hidden pr-2 pb-3"
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
              placeholder="Find repos and favorites…"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
          )}
        </div>
        {renderRow({ href: "/", label: "Inbox", icon: Inbox, count: unreadCount })}
      </div>
      <SidebarSection title="Favorites" icon={Star} collapsed={collapsed}>
        <RowList
          key={accountId}
          rows={favoriteRows}
          filter={filter}
          collapsed={collapsed}
          renderRow={renderRow}
        />
        {!collapsed && (
          <>
            {!favorites.length && (
              <Empty className="p-2">
                <EmptyDescription>Keep repos and views here.</EmptyDescription>
              </Empty>
            )}
            <Button
              variant="ghost"
              size="sm"
              disabled={!accountId}
              className="justify-start"
              onClick={() => {
                const store = useFavoritesStore.getState();
                if (isCurrentFavorite) store.remove(accountId, currentFavorite);
                else store.add(accountId, { kind: "view", href: current.href });
              }}
            >
              <Star data-icon="inline-start" />
              {isCurrentFavorite ? "Unfavorite current view" : "Favorite current view"}
            </Button>
            <p className="px-2 text-caption text-muted-foreground">
              {accountId
                ? "Only for this account, on this device."
                : "Sign in to save favorites on this device."}
            </p>
          </>
        )}
      </SidebarSection>
      <SidebarSection title="Your repos" icon={FolderGit2} collapsed={collapsed}>
        <RowList
          key={accountId}
          rows={(repos.data ?? []).map((repo) => repoRow(repo.full_name))}
          filter={filter}
          collapsed={collapsed}
          renderRow={renderRow}
        />
        {!collapsed && (
          <ListStatus
            pending={repos.isPending}
            error={repos.isError}
            empty={repos.isSuccess && !repos.data.length}
            onRetry={() => void repos.refetch()}
          />
        )}
      </SidebarSection>
      {(!!orgs.data?.length || orgs.isPending || orgs.isError) && (
        <SidebarSection title="Organizations" icon={Building2} collapsed={collapsed}>
          {(orgs.data ?? []).slice(0, orgLimit).map((org) => (
            <OrganizationRow
              key={`${accountId}:${org.id}`}
              org={org.login}
              filter={filter}
              collapsed={collapsed}
              renderRow={renderRow}
            />
          ))}
          {!collapsed && (orgs.data?.length ?? 0) > orgLimit && (
            <Button variant="ghost" size="sm" onClick={() => setOrgLimit((n) => n + 12)}>
              Show more organizations
            </Button>
          )}
          {!collapsed && (
            <ListStatus
              pending={orgs.isPending}
              error={orgs.isError}
              onRetry={() => void orgs.refetch()}
            />
          )}
        </SidebarSection>
      )}
    </nav>
  );
}

function repoRow(repo: string): Row {
  return { href: `/${repo}/code`, label: repo.split("/")[1]!, repo, kind: "repo" };
}
function ListStatus({
  pending,
  error,
  empty,
  onRetry,
}: {
  pending: boolean;
  error: boolean;
  empty?: boolean;
  onRetry: () => void;
}) {
  if (error)
    return (
      <div role="status" className="px-2 text-caption text-muted-foreground">
        Could not load repositories. Check account access.
        <Button variant="ghost" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  if (pending || empty)
    return (
      <p role="status" className="px-2 text-caption text-muted-foreground">
        {pending ? "Loading…" : "No accessible repositories."}
      </p>
    );
  return null;
}
function RowList({
  rows,
  filter,
  collapsed,
  renderRow,
}: {
  rows: Row[];
  filter: string;
  collapsed: boolean;
  renderRow: (row: Row) => ReactNode;
}) {
  const [limit, setLimit] = useState(6);
  const filtered = rows.filter((row) =>
    `${row.label} ${row.repo ?? ""}`.toLowerCase().includes(filter.trim().toLowerCase()),
  );
  const list = useStableList(filtered, {
    key: (row) => row.favorite?.id ?? row.href,
    resetKey: `${filter}:${rows.map((row) => row.favorite?.id ?? "").join(",")}`,
  });
  return (
    <div {...list.listProps} className="flex flex-col">
      {list.items.slice(0, limit).map(renderRow)}
      {!collapsed && filtered.length > limit && (
        <Button
          variant="ghost"
          size="sm"
          className="justify-start"
          onClick={() => setLimit((n) => n + 12)}
        >
          Show more
        </Button>
      )}
      {!collapsed && limit > 6 && (
        <Button variant="ghost" size="sm" className="justify-start" onClick={() => setLimit(6)}>
          Show less
        </Button>
      )}
      {!collapsed && filter.trim() && !filtered.length && (
        <p className="px-2 text-caption text-muted-foreground">No matches.</p>
      )}
    </div>
  );
}
function OrganizationRow({
  org,
  collapsed,
  filter,
  renderRow,
}: {
  org: string;
  collapsed: boolean;
  filter: string;
  renderRow: (row: Row) => ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const repos = useOrganizationRepositories(org, expanded && !collapsed);
  return (
    <Collapsible
      open={expanded && !collapsed}
      onOpenChange={(open) => {
        if (collapsed) useSidebarStore.getState().toggle();
        setExpanded(open);
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size={collapsed ? "icon" : "sm"}
              aria-label={`${org} repositories`}
              className={cn("w-full justify-start", !collapsed && "gap-2")}
            >
              <Building2 data-icon="inline-start" />
              {!collapsed && (
                <>
                  <span className="min-w-0 flex-1 truncate text-left">{org}</span>
                  <ChevronRight data-icon="inline-end" className={cn(expanded && "rotate-90")} />
                </>
              )}
            </Button>
          </CollapsibleTrigger>
        </TooltipTrigger>
        <TooltipContent side="right">{org} repositories</TooltipContent>
      </Tooltip>
      <CollapsibleContent className="pl-3">
        <RowList
          rows={(repos.data ?? []).map((repo) => repoRow(repo.full_name))}
          filter={filter}
          collapsed={collapsed}
          renderRow={renderRow}
        />
        <ListStatus
          pending={repos.isPending}
          error={repos.isError}
          empty={repos.isSuccess && !repos.data.length}
          onRetry={() => void repos.refetch()}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}
function SidebarSection({
  title,
  icon: Icon,
  collapsed,
  children,
}: {
  title: string;
  icon: typeof Inbox;
  collapsed: boolean;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-0">
      <h2 className="flex h-6 shrink-0 items-center gap-2 px-2 text-micro font-medium uppercase tracking-widest text-muted-foreground">
        <Icon className="size-4 shrink-0" aria-hidden />
        <span className={cn("truncate", collapsed && "sr-only")}>{title}</span>
      </h2>
      {children}
    </section>
  );
}

function SidebarRow({
  row,
  collapsed,
  beginDrag,
  onLaunch,
  active,
  open,
}: {
  row: Row;
  collapsed: boolean;
  beginDrag?: BeginDrag;
  onLaunch?: () => void;
  active: boolean;
  open: boolean;
}) {
  const accountId = useAuthStore((state) => state.accountId);
  const entry = { kind: row.kind ?? ("view" as const), href: row.href };
  const id = favoriteId(entry);
  const isFavorite = useFavoritesStore((state) =>
    state.forAccount(accountId).some((item) => item.id === id),
  );
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
      <div className="relative group">
        <Tooltip>
          <TooltipTrigger asChild>
            <ContextMenuTrigger asChild>
              <button
                type="button"
                data-sidebar-row
                data-sidebar-href={row.href}
                aria-label={
                  row.repo
                    ? `${row.label} · ${row.repo}`
                    : row.count
                      ? `${row.label}, ${row.count} unread`
                      : row.label
                }
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
                  !collapsed && "pr-8",
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
                    {!!row.count && (
                      <span aria-hidden className="text-caption tabular-nums text-muted-foreground">
                        {row.count}
                      </span>
                    )}
                    {row.kind === "repo" && open && (
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
        {!collapsed && row.kind && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                className="absolute right-1 top-1"
                aria-label={`${isFavorite ? "Remove favorite" : "Favorite"} ${row.label} · ${row.repo ?? row.href}`}
                disabled={!accountId}
                onClick={() => {
                  const store = useFavoritesStore.getState();
                  if (isFavorite) store.remove(accountId, id);
                  else store.add(accountId, entry);
                }}
              >
                <Star data-icon="inline-start" className={cn(isFavorite && "fill-current")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isFavorite
                ? "Remove favorite"
                : row.kind === "repo"
                  ? "Favorite repository"
                  : "Favorite view"}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
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
        <ContextMenuGroup>
          <ContextMenuItem
            disabled={!accountId}
            onSelect={() => {
              const store = useFavoritesStore.getState();
              if (isFavorite) store.remove(accountId, id);
              else store.add(accountId, entry);
            }}
          >
            {isFavorite
              ? "Remove favorite"
              : row.kind === "repo"
                ? "Favorite repository"
                : "Favorite view"}
          </ContextMenuItem>
        </ContextMenuGroup>
      </ContextMenuContent>
    </ContextMenu>
  );
}
