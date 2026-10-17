import { Building2, ChevronRight, FolderGit2, Funnel, Inbox, Star } from "lucide-react";
import { memo, type PointerEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { DockingMenu } from "@/app/components/shell/DockingMenu";
import { RepoMark } from "@/app/components/shell/RepoMark";
import { SidebarControls, SidebarRailFooter } from "@/app/components/shell/SidebarControls";
import type { useDocking } from "@/app/components/shell/useDocking";
import { Avatar } from "@/app/components/ui/avatar";
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
import { Input } from "@/app/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import { useNotificationUnreadCount } from "@/app/features/notifications/service";
import {
  type RepositoryList,
  type SidebarOrganization,
  useOrganizationRepositories,
  useRepositorySearch,
  useSidebarOrganizations,
  useYourRepositories,
} from "@/app/hooks/sidebarRepositories";
import { useMe } from "@/app/hooks/useMe";
import { useStableList } from "@/app/hooks/useStableList";
import { cn } from "@/app/lib/cn";
import { focusPaneOfFocusedTab, openInNewTab, openOrJump, openToSide } from "@/app/lib/tabActions";
import { getTabMeta, tabRepo } from "@/app/lib/tabMeta";
import { useAuthStore } from "@/app/stores/auth";
import {
  canFavorite,
  canonicalHref,
  type Favorite,
  favoriteId,
  useFavoritesStore,
} from "@/app/stores/favorites";
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

const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 360;
const INITIAL_ROWS = 6;

/** Memoized: the workspace area re-renders on layout changes the sidebar doesn't read. */
export const Sidebar = memo(function Sidebar({ beginDrag }: { beginDrag: BeginDrag }) {
  const { width, collapsed, resize, reset } = useSidebarStore();
  // While dragging, the width lives here; the store (and its localStorage
  // write) only hears the final width on pointer-up.
  const [drag, setDrag] = useState<number | null>(null);
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), []);
  const shownCollapsed = drag == null ? collapsed : drag < 140;
  const shownWidth = shownCollapsed
    ? SIDEBAR_RAIL_WIDTH
    : drag == null
      ? width
      : Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, drag));

  function startResize(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    cleanup.current?.();
    const target = event.currentTarget;
    const start = event.clientX;
    const initial = collapsed ? SIDEBAR_RAIL_WIDTH : width;
    let latest: number | null = null;
    target.setPointerCapture(event.pointerId);
    target.focus({ preventScroll: true });
    const move = (next: globalThis.PointerEvent) => {
      latest = initial + next.clientX - start;
      setDrag(latest);
    };
    const detach = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", end);
      target.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", key);
      if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
      cleanup.current = null;
      setDrag(null);
    };
    const end = () => {
      if (latest != null) resize(latest);
      detach();
    };
    const cancel = () => detach();
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
      data-sidebar-collapsed={shownCollapsed}
      style={{ width: shownWidth }}
      className={cn("relative mr-2 flex min-h-0 shrink-0 flex-col", !shownCollapsed && "px-2")}
    >
      <SidebarControls collapsed={shownCollapsed} />
      <SidebarContent collapsed={shownCollapsed} beginDrag={beginDrag} />
      {shownCollapsed && <SidebarRailFooter />}
      {/* biome-ignore lint/a11y/useSemanticElements: a keyboard-operable window splitter */}
      <div
        role="separator"
        tabIndex={0}
        aria-label="Resize sidebar"
        aria-orientation="vertical"
        // Below the minimum the sidebar snaps to the icon rail (Home, or drag under 140px).
        aria-valuemin={SIDEBAR_MIN_WIDTH}
        aria-valuemax={SIDEBAR_MAX_WIDTH}
        aria-valuenow={shownCollapsed ? SIDEBAR_MIN_WIDTH : shownWidth}
        aria-valuetext={shownCollapsed ? "Collapsed to icons" : `${shownWidth} pixels`}
        onPointerDown={startResize}
        onDoubleClick={reset}
        onKeyDown={(event) => {
          if (event.key === "Home") resize(0);
          else if (event.key === "End") resize(SIDEBAR_MAX_WIDTH);
          else if (event.key === "ArrowLeft")
            resize((collapsed ? SIDEBAR_RAIL_WIDTH : width) - (event.shiftKey ? 64 : 16));
          else if (event.key === "ArrowRight")
            resize((collapsed ? SIDEBAR_MIN_WIDTH : width) + (event.shiftKey ? 64 : 16));
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
});

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
  const [typed, setFilter] = useState("");
  // The rail has no filter field, so a filter must not keep applying invisibly.
  useEffect(() => {
    if (collapsed) setFilter("");
  }, [collapsed]);
  const filter = collapsed ? "" : typed;
  const input = useRef<HTMLInputElement>(null);
  const unreadCount = useNotificationUnreadCount();
  const workspace = useWorkspaceStore((state) => state.workspace);
  const accountId = useAuthStore((state) => state.accountId);
  const favorites = useFavoritesStore((state) => state.forAccount(accountId));
  const { data: me } = useMe();
  const [orgLimit, setOrgLimit] = useState(INITIAL_ROWS);
  const repos = useYourRepositories();
  const orgs = useSidebarOrganizations();
  const current = focusedTab(workspace);
  const currentHref = canonicalHref(current.href);
  const focusedRepo = tabRepo(hrefPathname(current.href))?.toLowerCase();
  const openRepos = new Set(
    islands(workspace.layout)
      .flatMap((island) => island.tabs)
      .map((tab) => tabRepo(hrefPathname(tab.href))?.toLowerCase()),
  );
  // Exactly one row is current: a favorite of this exact page, else a
  // favorite of its repo, else the repo's row in the lists below.
  const exactFavorite = favorites.find((item) => canonicalHref(item.href) === currentHref);
  const repoFavorite = favorites.find(
    (item) =>
      item.kind === "repo" && tabRepo(hrefPathname(item.href))?.toLowerCase() === focusedRepo,
  );
  const activeKey =
    hrefPathname(current.href) === "/"
      ? "inbox"
      : (exactFavorite ?? repoFavorite)
        ? `favorite:${(exactFavorite ?? repoFavorite)!.id}`
        : focusedRepo
          ? `repo:${focusedRepo}`
          : null;
  const renderRow = (row: Row) => (
    <SidebarRow
      key={row.favorite?.id ?? row.href}
      row={row}
      collapsed={collapsed}
      beginDrag={beginDrag}
      onLaunch={onLaunch}
      active={
        row.favorite
          ? activeKey === `favorite:${row.favorite.id}`
          : row.kind === "repo"
            ? activeKey === `repo:${row.repo?.toLowerCase()}`
            : row.href === "/" && activeKey === "inbox"
      }
      open={!!row.repo && openRepos.has(row.repo.toLowerCase())}
    />
  );
  const favoriteRows = favorites.map((item) => {
    const pathname = hrefPathname(item.href);
    const meta = getTabMeta(pathname);
    const repo = tabRepo(pathname);
    const name = repo?.split("/")[1];
    return {
      href: item.href,
      kind: item.kind,
      favorite: item,
      repo,
      // A view says where in the repo it goes (#43): "githut · Code".
      label:
        item.kind === "repo" ? (name ?? meta.label) : name ? `${name} · ${meta.label}` : meta.label,
      icon: meta.icon,
    };
  });
  const currentCanFavorite = !!accountId && canFavorite(current.href);
  return (
    <nav
      aria-label="Workspace navigation"
      data-link-menu="off"
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overflow-x-hidden pb-3",
        collapsed ? "px-1" : "pr-2",
      )}
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
                    useSidebarStore.getState().expand();
                    requestAnimationFrame(() => input.current?.focus());
                  }}
                >
                  <Funnel />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Filter sidebar</TooltipContent>
            </Tooltip>
          ) : (
            <Input
              ref={input}
              aria-label="Filter sidebar"
              placeholder="Find repos and favorites…"
              value={typed}
              onChange={(event) => setFilter(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape" && typed) {
                  event.preventDefault();
                  setFilter("");
                }
              }}
            />
          )}
        </div>
        {renderRow({ href: "/", label: "Inbox", icon: Inbox, count: unreadCount })}
      </div>
      <SidebarSection
        title="Favorites"
        icon={Star}
        collapsed={collapsed}
        action={
          !collapsed && currentCanFavorite ? (
            <FavoriteCurrentButton href={current.href} accountId={accountId} />
          ) : null
        }
      >
        <RowList
          key={accountId}
          rows={favoriteRows}
          filter={filter}
          collapsed={collapsed}
          renderRow={renderRow}
        />
        {!collapsed && !favorites.length && (
          <p className="px-2 text-caption text-muted-foreground">
            {accountId
              ? "Star a repo or page to keep it here."
              : "Sign in to keep favorites on this device."}
          </p>
        )}
      </SidebarSection>
      <SidebarSection
        id="sidebar-your-repos"
        title="Your repos"
        icon={FolderGit2}
        collapsed={collapsed}
      >
        <RepositoryRows
          key={accountId}
          list={repos}
          qualifier={me ? `user:${me.login}` : null}
          filter={filter}
          collapsed={collapsed}
          renderRow={renderRow}
        />
      </SidebarSection>
      {(!!orgs.data?.length || orgs.isPending || orgs.isError) && (
        <SidebarSection title="Organizations" icon={Building2} collapsed={collapsed}>
          {(orgs.data ?? []).slice(0, orgLimit).map((org) => (
            <OrganizationRow
              key={`${accountId}:${org.id}`}
              org={org}
              filter={filter}
              collapsed={collapsed}
              renderRow={renderRow}
            />
          ))}
          {!collapsed && (orgs.data?.length ?? 0) > orgLimit && (
            <ShowMore onClick={() => setOrgLimit((n) => n + 12)}>Show more organizations</ShowMore>
          )}
          {!collapsed && (
            <ListStatus
              noun="organizations"
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

function FavoriteCurrentButton({ href, accountId }: { href: string; accountId: number | null }) {
  const favorites = useFavoritesStore((state) => state.forAccount(accountId));
  const canonical = canonicalHref(href);
  // A repo favorite of this Code page counts too; there is one row per place.
  const saved = favorites.find((item) => canonicalHref(item.href) === canonical);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={saved ? "Remove this page from favorites" : "Favorite this page"}
          aria-pressed={!!saved}
          onClick={() => {
            const store = useFavoritesStore.getState();
            if (saved) store.remove(accountId, saved.id);
            else store.add(accountId, { kind: "view", href });
          }}
        >
          <Star data-icon="inline-start" className={cn(saved && "fill-current")} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {saved ? "Remove this page from favorites" : "Favorite this page"}
        <span className="block text-muted-foreground">Only for this account, on this device.</span>
      </TooltipContent>
    </Tooltip>
  );
}

function repoRow(repo: string): Row {
  return { href: `/${repo}/code`, label: repo.split("/")[1]!, repo, kind: "repo" };
}

function ShowMore({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="justify-start text-muted-foreground"
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function ListStatus({
  noun = "repositories",
  pending,
  error,
  empty,
  onRetry,
}: {
  noun?: "repositories" | "organizations";
  pending: boolean;
  error: boolean;
  empty?: boolean;
  onRetry: () => void;
}) {
  if (error)
    return (
      <div
        role="status"
        className="flex items-center gap-1 px-2 text-caption text-muted-foreground"
      >
        Could not load {noun}.
        <Button variant="ghost" size="xs" onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  if (pending || empty)
    return (
      <p role="status" className="px-2 text-caption text-muted-foreground">
        {pending ? "Loading…" : `No accessible ${noun}.`}
      </p>
    );
  return null;
}

function matches(row: Row, filter: string) {
  return `${row.label} ${row.repo ?? ""}`.toLowerCase().includes(filter.trim().toLowerCase());
}

function RowList({
  rows,
  filter,
  collapsed,
  renderRow,
  more,
}: {
  rows: Row[];
  filter: string;
  collapsed: boolean;
  renderRow: (row: Row) => ReactNode;
  /** More rows exist on the server; "Show more" fetches the next page. */
  more?: { hasMore: boolean; loading: boolean; load: () => void };
}) {
  const [limit, setLimit] = useState(INITIAL_ROWS);
  const filtered = rows.filter((row) => matches(row, filter));
  const list = useStableList(filtered, {
    key: (row) => row.favorite?.id ?? row.href,
    resetKey: `${filter}:${rows.map((row) => row.favorite?.id ?? "").join(",")}`,
  });
  const searching = !!filter.trim();
  const canShowMore = filtered.length > limit || (!searching && !!more?.hasMore);
  return (
    <div {...list.listProps} className="flex flex-col">
      {list.items.slice(0, limit).map(renderRow)}
      {!collapsed && canShowMore && (
        <ShowMore
          onClick={() => {
            setLimit((n) => n + 12);
            if (filtered.length <= limit + 12) more?.load();
          }}
        >
          {more?.loading ? "Loading…" : "Show more"}
        </ShowMore>
      )}
      {!collapsed && limit > INITIAL_ROWS && (
        <ShowMore onClick={() => setLimit(INITIAL_ROWS)}>Show less</ShowMore>
      )}
    </div>
  );
}

/** A repo list loaded a page at a time, searched on GitHub when the filter outruns it. */
function RepositoryRows({
  list,
  qualifier,
  filter,
  collapsed,
  renderRow,
}: {
  list: RepositoryList;
  qualifier: string | null;
  filter: string;
  collapsed: boolean;
  renderRow: (row: Row) => ReactNode;
}) {
  const term = filter.trim();
  const search = useRepositorySearch(qualifier, term, !!term && list.hasMore);
  const loaded = list.items.map((repo) => repoRow(repo.full_name));
  const known = new Set(loaded.map((row) => row.repo!.toLowerCase()));
  const found = list.hasMore
    ? (search.data ?? [])
        .filter((repo) => !known.has(repo.full_name.toLowerCase()))
        .map((repo) => repoRow(repo.full_name))
    : [];
  const rows = [...loaded, ...found];
  const noMatches = !!term && !rows.some((row) => matches(row, term));
  return (
    <>
      <RowList
        rows={rows}
        filter={filter}
        collapsed={collapsed}
        renderRow={renderRow}
        more={{ hasMore: list.hasMore, loading: list.loadingMore, load: list.loadMore }}
      />
      {!collapsed && noMatches && (
        <p role="status" className="px-2 text-caption text-muted-foreground">
          {search.isFetching ? "Searching…" : "No matches."}
        </p>
      )}
      {!collapsed && (
        <ListStatus
          pending={list.isPending}
          error={list.isError}
          empty={list.isSuccess && !list.items.length}
          onRetry={list.refetch}
        />
      )}
    </>
  );
}

function OrganizationRow({
  org,
  collapsed,
  filter,
  renderRow,
}: {
  org: SidebarOrganization;
  collapsed: boolean;
  filter: string;
  renderRow: (row: Row) => ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const repos = useOrganizationRepositories(org.login, expanded && !collapsed);
  return (
    <Collapsible
      open={expanded && !collapsed}
      onOpenChange={(open) => {
        if (collapsed) useSidebarStore.getState().expand();
        setExpanded(open);
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size={collapsed ? "icon" : "default"}
              aria-label={`${org.login} repositories`}
              className={cn(
                // Expanded is a chevron state, not a selection.
                "w-full aria-expanded:bg-transparent aria-expanded:hover:bg-muted",
                collapsed ? "justify-center" : "justify-start gap-2 px-2 font-normal",
              )}
            >
              <Avatar
                login={org.login}
                avatarUrl={org.avatar_url}
                size="xs"
                className="rounded-sm after:rounded-sm [&_img]:rounded-sm"
              />
              {!collapsed && (
                <>
                  <span className="min-w-0 flex-1 truncate text-left">{org.login}</span>
                  <ChevronRight data-icon="inline-end" className={cn(expanded && "rotate-90")} />
                </>
              )}
            </Button>
          </CollapsibleTrigger>
        </TooltipTrigger>
        <TooltipContent side="right">{org.login} repositories</TooltipContent>
      </Tooltip>
      <CollapsibleContent className="pl-3">
        <RepositoryRows
          list={repos}
          qualifier={`org:${org.login}`}
          filter={filter}
          collapsed={collapsed}
          renderRow={renderRow}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}

function SidebarSection({
  id,
  title,
  icon: Icon,
  collapsed,
  action,
  children,
}: {
  id?: string;
  title: string;
  icon: typeof Inbox;
  collapsed: boolean;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-label={title} className="flex flex-col gap-0">
      <div className="flex h-6 shrink-0 items-center gap-2 px-2">
        <h2 className="flex min-w-0 flex-1 items-center gap-2 text-micro font-medium uppercase tracking-widest text-muted-foreground">
          <Icon className="size-4 shrink-0" aria-hidden />
          <span className={cn("truncate", collapsed && "sr-only")}>{title}</span>
        </h2>
        {action}
      </div>
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
  const favoritable = canFavorite(row.href);
  const navigation = useRef(false);
  const Icon = row.icon ?? Star;
  const launch = (action: () => void) => {
    navigation.current = true;
    action();
    onLaunch?.();
    focusPaneOfFocusedTab();
  };
  const toggleFavorite = () => {
    const store = useFavoritesStore.getState();
    if (isFavorite) store.remove(accountId, id);
    else store.add(accountId, entry);
  };
  const favoriteLabel = isFavorite
    ? "Remove favorite"
    : row.kind === "repo"
      ? "Favorite repository"
      : "Favorite view";
  return (
    <ContextMenu>
      <div className="group relative">
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
                  "relative flex h-8 w-full shrink-0 items-center gap-2 rounded-lg px-2 text-left text-ui outline-none hover:bg-accent focus-visible:ring-1 focus-visible:ring-foreground/15",
                  active && "bg-accent hover:bg-accent",
                  !collapsed && "pr-8",
                )}
              >
                {row.repo ? (
                  <RepoMark repo={row.repo} />
                ) : (
                  <Icon aria-hidden className="size-4 shrink-0" />
                )}
                {collapsed && !!row.count && (
                  // The rail keeps unread visible as a corner dot.
                  <span
                    aria-hidden
                    className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-primary"
                  />
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
        {!collapsed && row.kind && favoritable && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                className={cn(
                  "absolute top-1 right-1",
                  // Stars reveal on hover or focus; a favorite keeps its filled star.
                  !isFavorite &&
                    "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100",
                )}
                aria-label={`${isFavorite ? "Remove favorite" : "Favorite"} ${row.label} · ${row.repo ?? row.href}`}
                disabled={!accountId}
                onClick={toggleFavorite}
              >
                <Star className={cn(isFavorite && "fill-current")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{favoriteLabel}</TooltipContent>
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
        {favoritable && (
          <ContextMenuGroup>
            <ContextMenuItem disabled={!accountId} onSelect={toggleFavorite}>
              {favoriteLabel}
            </ContextMenuItem>
          </ContextMenuGroup>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
