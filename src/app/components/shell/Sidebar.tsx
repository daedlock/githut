import { ChevronDown, ChevronRight, Inbox, Star } from "lucide-react";
import { memo, type PointerEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { DockingMenu } from "@/app/components/shell/DockingMenu";
import { RepoMark } from "@/app/components/shell/RepoMark";
import { ShellTipContent, TipId } from "@/app/components/shell/ShellTip";
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
import { Tooltip, TooltipTrigger } from "@/app/components/ui/tooltip";
import { useNotificationUnreadCount } from "@/app/features/notifications/service";
import {
  type RepositoryList,
  type SidebarOrganization,
  useOrganizationRepositories,
  useSidebarOrganizations,
  useYourRepositories,
} from "@/app/hooks/sidebarRepositories";
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
  /** A favorited view's section, shown after the repo name: "nickai-app › PRs". */
  view?: string;
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
          className="pointer-events-none absolute top-[calc(var(--island-tabs-height)+0.75rem-1px)] bottom-3 left-1/2 w-0.5 rounded-full bg-primary opacity-0 group-hover:opacity-90 group-focus-visible:opacity-90"
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
  const unreadCount = useNotificationUnreadCount();
  const workspace = useWorkspaceStore((state) => state.workspace);
  const accountId = useAuthStore((state) => state.accountId);
  const favorites = useFavoritesStore((state) => state.forAccount(accountId));
  const [orgLimit, setOrgLimit] = useState(INITIAL_ROWS);
  const repos = useYourRepositories();
  const orgs = useSidebarOrganizations();
  const current = focusedTab(workspace);
  const currentHref = canonicalHref(current.href);
  const focusedRepo = tabRepo(hrefPathname(current.href))?.toLowerCase();
  const openTabs = new Map<string, number>();
  for (const tab of islands(workspace.layout).flatMap((island) => island.tabs)) {
    const repo = tabRepo(hrefPathname(tab.href))?.toLowerCase();
    if (repo) openTabs.set(repo, (openTabs.get(repo) ?? 0) + 1);
  }
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
      openTabs={(row.repo && openTabs.get(row.repo.toLowerCase())) || 0}
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
      view: item.kind === "repo" || !name ? undefined : meta.label,
      icon: meta.icon,
    };
  });
  const currentCanFavorite = !!accountId && canFavorite(current.href);
  return (
    <nav
      aria-label="Workspace navigation"
      data-link-menu="off"
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto overflow-x-hidden pb-3",
        collapsed ? "px-1" : "pr-2",
      )}
    >
      <div className="flex flex-col pt-0.5">
        {renderRow({ href: "/", label: "Inbox", icon: Inbox, count: unreadCount })}
      </div>
      <SidebarSection
        title="Favorites"
        collapsed={collapsed}
        action={
          !collapsed && currentCanFavorite ? (
            <FavoriteCurrentButton href={current.href} accountId={accountId} />
          ) : null
        }
      >
        <RowList key={accountId} rows={favoriteRows} collapsed={collapsed} renderRow={renderRow} />
        {!collapsed && !favorites.length && (
          <p className="px-2 text-caption text-muted-foreground">
            {accountId
              ? "Star a repo or page to keep it here."
              : "Sign in to keep favorites on this device."}
          </p>
        )}
      </SidebarSection>
      <SidebarSection id="sidebar-your-repos" title="Your repos" collapsed={collapsed}>
        <RepositoryRows key={accountId} list={repos} collapsed={collapsed} renderRow={renderRow} />
      </SidebarSection>
      {(!!orgs.data?.length || orgs.isPending || orgs.isError) && (
        <SidebarSection title="Organizations" collapsed={collapsed}>
          {(orgs.data ?? []).slice(0, orgLimit).map((org) => (
            <OrganizationRow
              key={`${accountId}:${org.id}`}
              org={org}
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
          // Revealed with the section's hover, like its collapse caret; a saved page keeps its filled star.
          className={cn(
            !saved &&
              "opacity-0 group-hover/section:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100",
          )}
          onClick={() => {
            const store = useFavoritesStore.getState();
            if (saved) store.remove(accountId, saved.id);
            else store.add(accountId, { kind: "view", href });
          }}
        >
          <Star data-icon="inline-start" className={cn(saved && "fill-current")} />
        </Button>
      </TooltipTrigger>
      <ShellTipContent
        title={saved ? "Remove this page from favorites" : "Favorite this page"}
        detail={[<span key="d">Only for this account, on this device</span>]}
      />
    </Tooltip>
  );
}

function repoRow(repo: string): Row {
  return { href: `/${repo}/code`, label: repo.split("/")[1]!, repo, kind: "repo" };
}

function ShowMore({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-7 items-center rounded-md px-2 text-left text-ui text-(--color-fg-faint) outline-none hover:bg-accent hover:text-muted-foreground focus-visible:ring-1 focus-visible:ring-foreground/15"
    >
      {children}
    </button>
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

function RowList({
  rows,
  collapsed,
  renderRow,
  more,
}: {
  rows: Row[];
  collapsed: boolean;
  renderRow: (row: Row) => ReactNode;
  /** More rows exist on the server; "Show more" fetches the next page. */
  more?: { hasMore: boolean; loading: boolean; load: () => void };
}) {
  const [limit, setLimit] = useState(INITIAL_ROWS);
  const list = useStableList(rows, {
    key: (row) => row.favorite?.id ?? row.href,
    resetKey: rows.map((row) => row.favorite?.id ?? "").join(","),
  });
  const canShowMore = rows.length > limit || !!more?.hasMore;
  return (
    <div {...list.listProps} className="flex flex-col">
      {list.items.slice(0, limit).map(renderRow)}
      {!collapsed && canShowMore && (
        <ShowMore
          onClick={() => {
            setLimit((n) => n + 12);
            if (rows.length <= limit + 12) more?.load();
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

/** A repo list loaded a page at a time. */
function RepositoryRows({
  list,
  collapsed,
  renderRow,
}: {
  list: RepositoryList;
  collapsed: boolean;
  renderRow: (row: Row) => ReactNode;
}) {
  return (
    <>
      <RowList
        rows={list.items.map((repo) => repoRow(repo.full_name))}
        collapsed={collapsed}
        renderRow={renderRow}
        more={{ hasMore: list.hasMore, loading: list.loadingMore, load: list.loadMore }}
      />
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
  renderRow,
}: {
  org: SidebarOrganization;
  collapsed: boolean;
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
            <button
              type="button"
              aria-label={`${org.login} repositories`}
              className={cn(
                "flex h-7 w-full items-center gap-2 rounded-md text-left text-ui text-foreground/90 outline-none hover:bg-accent focus-visible:ring-1 focus-visible:ring-foreground/15",
                collapsed ? "justify-center" : "px-2",
              )}
            >
              <Avatar
                login={org.login}
                avatarUrl={org.avatar_url}
                size="xs"
                className="rounded-sm after:rounded-sm [&_img]:rounded-sm"
              />
              {!collapsed && (
                <span className="flex min-w-0 flex-1 items-center gap-1">
                  <span className="truncate">{org.login}</span>
                  <ChevronRight
                    aria-hidden
                    className={cn(
                      "size-3 shrink-0 text-(--color-fg-faint) transition-transform duration-150",
                      expanded && "rotate-90",
                    )}
                  />
                </span>
              )}
            </button>
          </CollapsibleTrigger>
        </TooltipTrigger>
        <ShellTipContent
          side="right"
          title={org.login}
          detail={[<span key="d">{expanded ? "Hide" : "Show"} repositories</span>]}
        />
      </Tooltip>
      {/* Nested repos hang off a guide line under the organization's avatar. */}
      <CollapsibleContent className="relative pl-3.5 before:absolute before:inset-y-0.5 before:left-3.75 before:w-px before:bg-foreground/8">
        <RepositoryRows list={repos} collapsed={collapsed} renderRow={renderRow} />
      </CollapsibleContent>
    </Collapsible>
  );
}

function SidebarSection({
  id,
  title,
  collapsed,
  action,
  children,
}: {
  id?: string;
  title: string;
  collapsed: boolean;
  action?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Collapsible asChild open={open || collapsed} onOpenChange={setOpen}>
      <section id={id} aria-label={title} className="flex flex-col">
        {collapsed ? (
          // The rail separates sections with a hairline; the title stays for screen readers.
          <h2 className="mx-2 my-1.5 h-px bg-foreground/8">
            <span className="sr-only">{title}</span>
          </h2>
        ) : (
          <div className="group/section flex h-7 shrink-0 items-center gap-1 pr-0.5 pl-2">
            <h2 className="min-w-0 flex-1">
              <CollapsibleTrigger className="flex max-w-full items-center gap-1 rounded-sm text-caption font-medium text-(--color-fg-faint) outline-none hover:text-muted-foreground focus-visible:ring-1 focus-visible:ring-foreground/15">
                <span className="truncate">{title}</span>
                <ChevronDown
                  aria-hidden
                  className={cn(
                    "size-3 shrink-0 opacity-0 transition-[opacity,transform] duration-150 group-hover/section:opacity-100 group-focus-within/section:opacity-100",
                    !open && "-rotate-90 opacity-100",
                  )}
                />
              </CollapsibleTrigger>
            </h2>
            {action}
          </div>
        )}
        <CollapsibleContent className="flex flex-col">{children}</CollapsibleContent>
      </section>
    </Collapsible>
  );
}

function SidebarRow({
  row,
  collapsed,
  beginDrag,
  onLaunch,
  active,
  openTabs,
}: {
  row: Row;
  collapsed: boolean;
  beginDrag?: BeginDrag;
  onLaunch?: () => void;
  active: boolean;
  /** Tabs open on this row's repo, anywhere in the workspace. */
  openTabs: number;
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
  const hasStar = !collapsed && !!row.kind && favoritable;
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
                  "relative flex h-7 w-full shrink-0 items-center gap-2 rounded-md px-2 text-left text-ui text-foreground/90 outline-none hover:bg-accent focus-visible:ring-1 focus-visible:ring-foreground/15",
                  active && "bg-accent text-foreground hover:bg-accent",
                  !collapsed && "pr-1.5",
                )}
              >
                {row.repo ? (
                  <RepoMark repo={row.repo} />
                ) : (
                  <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                )}
                {collapsed && !!row.count && (
                  // The rail keeps unread visible as a corner dot.
                  <span
                    aria-hidden
                    className="absolute top-1 right-1 size-1.5 rounded-full bg-primary"
                  />
                )}
                {!collapsed && (
                  <>
                    <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
                      <span className="truncate">
                        {row.view ? row.label.split(" · ")[0] : row.label}
                      </span>
                      {row.view && (
                        <span className="shrink-0 text-(--color-fg-faint)">› {row.view}</span>
                      )}
                    </span>
                    {/* One trailing slot: a quiet status at rest; the star takes it on hover. */}
                    <span
                      className={cn(
                        "flex h-5 min-w-5 shrink-0 items-center justify-end",
                        hasStar &&
                          "group-hover:invisible group-focus-within:invisible [@media(hover:none)]:invisible",
                      )}
                    >
                      {!!row.count && (
                        <span
                          aria-hidden
                          className="min-w-4.5 rounded-full bg-foreground/8 px-1.5 text-center text-micro leading-4 font-medium tabular-nums text-muted-foreground"
                        >
                          {row.count}
                        </span>
                      )}
                      {row.kind === "repo" && openTabs > 0 && (
                        <span role="img" aria-label="Has open tabs" className="flex gap-0.5">
                          {Array.from({ length: Math.min(openTabs, 3) }, (_, i) => (
                            <span
                              // biome-ignore lint/suspicious/noArrayIndexKey: identical dots
                              key={i}
                              className="size-0.75 rounded-full bg-(--color-fg-faint)"
                            />
                          ))}
                        </span>
                      )}
                    </span>
                  </>
                )}
              </button>
            </ContextMenuTrigger>
          </TooltipTrigger>
          <ShellTipContent
            side="right"
            title={row.view ? `${row.label.split(" · ")[0]} › ${row.view}` : row.label}
            detail={[
              row.repo && <TipId key="repo">{row.repo}</TipId>,
              !!row.count && <span key="count">{row.count} unread</span>,
              openTabs > 0 && (
                <span key="tabs">
                  {openTabs} open {openTabs === 1 ? "tab" : "tabs"}
                </span>
              ),
              row.meta && <span key="meta">{row.meta}</span>,
            ]}
          />
        </Tooltip>
        {hasStar && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                aria-label={`${isFavorite ? "Remove favorite" : "Favorite"} ${row.label} · ${row.repo ?? row.href}`}
                disabled={!accountId}
                onClick={toggleFavorite}
              >
                <Star className={cn(isFavorite && "fill-current")} />
              </Button>
            </TooltipTrigger>
            <ShellTipContent title={favoriteLabel} />
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
