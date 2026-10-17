import { Link, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  BellOff,
  Check,
  CheckCircle2,
  CircleDot,
  CloudOff,
  GitCommitHorizontal,
  GitPullRequest,
  KeyRound,
  type LucideIcon,
  Mail,
  MailOpen,
  MessagesSquare,
  MoreHorizontal,
  ShieldAlert,
  Tag,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LiveUpdates } from "@/app/components/LiveUpdates";
import { RepoMark } from "@/app/components/shell/RepoMark";
import { Button } from "@/app/components/ui/button";
import { Container } from "@/app/components/ui/Container";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { Skeleton, SkeletonGroup } from "@/app/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/app/components/ui/toggle-group";
import { YourWorkView } from "@/app/features/dashboard/YourWorkView";
import {
  BarAction,
  type BarNotice,
  FloatingActionBar,
} from "@/app/features/repo/components/BulkActionBar";
import {
  BulkRowCheckbox,
  SelectionRoot,
  useBulkRow,
  useSelection,
} from "@/app/features/repo/components/BulkSelection";
import { useKeybindings } from "@/app/hooks/useKeybindings";
import { useListNavigation } from "@/app/hooks/useListNavigation";
import { useStableList } from "@/app/hooks/useStableList";
import { startReauth } from "@/app/lib/auth";
import { cn } from "@/app/lib/cn";
import { useBrowserOnline, useCanMutate } from "@/app/lib/connectivity";
import { openInNewTab, openToSide } from "@/app/lib/tabActions";
import { useTabScope } from "@/app/lib/tabScope";
import { formatRelativeTime } from "@/app/lib/time";
import { useAuthStore } from "@/app/stores/auth";
import { useSidebarStore } from "@/app/stores/sidebar";
import { useWorkspaceView } from "@/app/stores/workspaceView";
import { findTab, focusedTab } from "@/app/workspace/model";
import { getWorkspace, useWorkspaceStore } from "@/app/workspace/store";
import {
  isParticipating,
  type Notification,
  notificationGitHubHref,
  notificationHref,
} from "./api";
import {
  loadMoreNotifications,
  type NotificationAction,
  notificationIsUnread,
  runNotificationAction,
  useNotificationState,
  useNotifications,
  useNotificationUnreadCount,
} from "./service";

export type HomeView = "all" | "work" | undefined;

/**
 * Home: the Inbox (Participating, or All at `/?view=all`) and Your work at
 * `/?view=work`. One heading and one switch; no navigation bar in the page.
 */
export function InboxPage({ view }: { view?: HomeView }) {
  const navigate = useNavigate();
  const unread = useNotificationUnreadCount(view === "all" ? "all" : "participating");
  const value = view ?? "participating";
  return (
    <main className="min-h-full min-w-0 pb-24">
      <Container className="pt-6 sm:pr-14">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <h1 className="text-heading font-semibold">
              {view === "work" ? "Your work" : "Inbox"}
            </h1>
            {view !== "work" && unread > 0 && (
              <span className="text-caption tabular-nums text-muted-foreground">
                {unread} unread
              </span>
            )}
          </div>
          <ToggleGroup
            type="single"
            size="sm"
            value={value}
            onValueChange={(next) => {
              if (next === "participating") void navigate({ to: "/", search: {} });
              else if (next === "all" || next === "work")
                void navigate({ to: "/", search: { view: next } });
            }}
            aria-label="Home view"
          >
            <ToggleGroupItem value="participating">Participating</ToggleGroupItem>
            <ToggleGroupItem value="all">All</ToggleGroupItem>
            <ToggleGroupItem value="work">Your work</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </Container>
      {view === "work" ? (
        <YourWorkView />
      ) : (
        <InboxList
          filter={view === "all" ? "all" : "participating"}
          onShowAll={() => void navigate({ to: "/", search: { view: "all" } })}
        />
      )}
    </main>
  );
}

const SUBJECT_ICONS: Record<string, LucideIcon> = {
  PullRequest: GitPullRequest,
  Issue: CircleDot,
  Release: Tag,
  Discussion: MessagesSquare,
  Commit: GitCommitHorizontal,
  CheckSuite: CheckCircle2,
  RepositoryVulnerabilityAlert: ShieldAlert,
  RepositoryDependabotAlertsThread: ShieldAlert,
};

const VERBS: Record<NotificationAction, string> = {
  done: "Done",
  read: "Marked read",
  unread: "Marked unread on this device",
  unsubscribe: "Unsubscribed",
};

/** Selection keys are numbers; GitHub thread IDs are numeric strings. */
const rowKey = (id: string) => Number(id);

function InboxList({
  filter,
  onShowAll,
}: {
  filter: "participating" | "all";
  onShowAll: () => void;
}) {
  const { data, isPending, isError, error, isFetching } = useNotifications();
  const online = useBrowserOnline();
  const expired = useAuthStore((state) => state.expired);
  const [actionVersion, setActionVersion] = useState(0);
  const [notice, setNotice] = useState<BarNotice | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const incoming = useMemo(
    () => data?.items.filter((item) => filter === "all" || isParticipating(item)) ?? [],
    [data, filter],
  );
  const { items: rows, listProps } = useStableList(incoming, {
    key: (item) => item.id,
    resetKey: `${filter}:${actionVersion}`,
  });
  const hiddenUnread =
    filter === "participating"
      ? (data?.items.filter((item) => !isParticipating(item) && notificationIsUnread(item))
          .length ?? 0)
      : 0;
  useListNavigation(!isPending);

  const dismiss = useCallback(() => setNotice(null), []);
  const act = useCallback(async (targets: string[], action: NotificationAction) => {
    if (!targets.length) return;
    setNotice(null);
    const retry = (failed: string[]) => ({
      label: "Retry",
      run: () => void act(failed, action),
      needsWrite: action !== "unread",
    });
    try {
      const result = await runNotificationAction(targets, action);
      setActionVersion((version) => version + 1);
      const failed = result.failed.map((item) => item.id);
      const count = result.succeeded.length;
      setNotice(
        failed.length
          ? {
              id: Date.now(),
              tone: "error",
              message: `Could not update ${failed.length} notification${failed.length === 1 ? "" : "s"}`,
              detail: result.failed[0]?.message,
              action: retry(failed),
            }
          : {
              id: Date.now(),
              tone: "success",
              message: `${VERBS[action]}${count > 1 ? ` · ${count} notifications` : ""}`,
            },
      );
    } catch (error) {
      setNotice({
        id: Date.now(),
        tone: "error",
        message: "Could not update notifications",
        detail: error instanceof Error ? error.message : undefined,
        action: retry(targets),
      });
    }
  }, []);

  const loadMore = async () => {
    setLoadingMore(true);
    setMoreError(null);
    try {
      await loadMoreNotifications();
    } catch (error) {
      setMoreError(error instanceof Error ? error.message : "Could not load more");
    } finally {
      setLoadingMore(false);
    }
  };

  // Polling never starts offline or with an expired sign-in, so say so
  // instead of showing a skeleton that never resolves.
  const blocked = !data && (!online || expired);

  return (
    <Container className="sm:pr-14">
      <SelectionRoot
        visible={rows.map((item) => rowKey(item.id))}
        bar={<InboxBar notice={notice} onDismiss={dismiss} act={act} items={data?.items} />}
      >
        {isError && !blocked && (
          <p role="status" className="mb-4 text-caption text-destructive">
            {data ? "Notifications could not refresh. " : "Could not load notifications. "}
            {error.message} {isFetching ? "Retrying…" : "We'll retry when GitHub is available."}
          </p>
        )}
        {blocked ? (
          <BlockedState offline={!online} />
        ) : isPending ? (
          <SkeletonGroup label="Loading notifications" className="flex flex-col gap-5">
            {[0, 1, 2, 3, 4].map((index) => (
              <div key={index} className="flex gap-3 px-3">
                <Skeleton className="size-4 rounded" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-3/5" />
                  <Skeleton className="h-3 w-2/5" />
                </div>
              </div>
            ))}
          </SkeletonGroup>
        ) : !rows.length && !isError && !data?.hasMore ? (
          <CaughtUp hiddenUnread={hiddenUnread} onShowAll={onShowAll} />
        ) : (
          <LiveUpdates ready={!isPending} announce={false}>
            <InboxRows rows={rows} listProps={listProps} act={act} />
          </LiveUpdates>
        )}
        {data?.hasMore && !blocked && (
          <div className="mt-3 flex items-center gap-2 px-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={loadingMore || !online || expired}
              onClick={() => void loadMore()}
            >
              {loadingMore ? "Loading…" : "Load older notifications"}
            </Button>
            {moreError && (
              <span role="status" className="text-caption text-destructive">
                {moreError}
              </span>
            )}
          </div>
        )}
      </SelectionRoot>
    </Container>
  );
}

const notificationRows = (root: HTMLElement | null) =>
  Array.from(root?.querySelectorAll<HTMLElement>("[data-notification-row]") ?? []);

function focusedNotificationRow(root: HTMLElement | null) {
  const row = document.activeElement?.closest<HTMLElement>("[data-notification-row]");
  return row && root?.contains(row) ? row : null;
}

function InboxRows({
  rows,
  listProps,
  act,
}: {
  rows: Notification[];
  listProps: ReturnType<typeof useStableList<Notification>>["listProps"];
  act: (targets: string[], action: NotificationAction) => Promise<void>;
}) {
  const localUnread = useNotificationState((state) => state.unread);
  const busy = useNotificationState((state) => state.busy);
  const { canMutate, reason } = useCanMutate();
  const { selected } = useSelection();
  const root = useRef<HTMLElement>(null);
  /** Index of the row a keyboard action came from; focus returns to that slot. */
  const refocus = useRef<number | null>(null);

  const rowElements = () => notificationRows(root.current);
  const focusedRow = () => focusedNotificationRow(root.current);
  const currentIds = () => {
    if (selected.size) return [...selected].map(String);
    const row = focusedRow();
    return row ? [row.dataset.notificationRow!] : [];
  };

  // Done removes the focused row; keep triage going from the same slot
  // instead of dropping focus to <body> (and the next `e` doing nothing).
  useEffect(() => {
    const index = refocus.current;
    if (index == null || !rows.length) return;
    if (focusedNotificationRow(root.current)) return;
    refocus.current = null;
    const elements = notificationRows(root.current);
    elements[Math.min(index, elements.length - 1)]
      ?.querySelector<HTMLElement>("[data-keyboard-list-item]")
      ?.focus();
  }, [rows]);

  const keyboardAct = (action: NotificationAction | "toggle") => {
    // A dialog over the page (Settings) owns the keyboard.
    if (document.activeElement?.closest("[role=dialog], [role=alertdialog]")) return;
    const targets = currentIds();
    if (!targets.length) return;
    const row = focusedRow();
    if (row) refocus.current = rowElements().indexOf(row);
    const next =
      action === "toggle"
        ? rows.some((item) => targets.includes(item.id) && notificationIsUnread(item))
          ? "read"
          : "unread"
        : action;
    if (next !== "unread" && !canMutate) return;
    void act(targets, next);
  };

  useKeybindings({
    e: () => keyboardAct("done"),
    "shift+u": () => keyboardAct("toggle"),
  });

  return (
    <section ref={root} aria-label="Notifications" className="flex flex-col gap-1" {...listProps}>
      {rows.map((item) => (
        <NotificationRow
          key={item.id}
          item={item}
          unread={item.unread || !!localUnread[item.id]}
          deviceOnly={!!localUnread[item.id] && !item.unread}
          busy={busy.includes(item.id)}
          canMutate={canMutate}
          unavailableReason={reason}
          onAction={(action) => void act([item.id], action)}
        />
      ))}
    </section>
  );
}

function InboxBar({
  notice,
  onDismiss,
  act,
  items,
}: {
  notice: BarNotice | null;
  onDismiss: () => void;
  act: (targets: string[], action: NotificationAction) => Promise<void>;
  items?: Notification[];
}) {
  const { selected } = useSelection();
  const busy = useNotificationState((state) => state.busy);
  const { canMutate, reason } = useCanMutate();
  const { tabId } = useTabScope();
  const isFocused = useWorkspaceStore((state) => focusedTab(state.workspace).id === tabId);
  const ids = [...selected].map(String);
  const anyUnread = !!items?.some((item) => ids.includes(item.id) && notificationIsUnread(item));
  const pending = busy.length > 0;
  const blocked = !canMutate || pending;
  // The bar is fixed to the window; only the focused tab's Inbox shows it.
  if (!isFocused) return null;
  return (
    <FloatingActionBar
      label="Notification bulk actions"
      pending={pending}
      notice={notice}
      onDismiss={onDismiss}
    >
      <BarAction
        icon={Check}
        label="Done"
        hint={reason ?? "Done"}
        shortcut="E"
        disabled={blocked}
        onClick={() => void act(ids, "done")}
      />
      {anyUnread ? (
        <BarAction
          icon={MailOpen}
          label="Read"
          hint={reason ?? "Mark read"}
          shortcut="Shift+U"
          disabled={blocked}
          onClick={() => void act(ids, "read")}
        />
      ) : (
        <BarAction
          icon={Mail}
          label="Unread"
          hint="Mark unread on this device"
          shortcut="Shift+U"
          disabled={pending}
          onClick={() => void act(ids, "unread")}
        />
      )}
      <BarAction
        icon={BellOff}
        label="Unsubscribe"
        hint={reason ?? "Unsubscribe until you're mentioned or comment"}
        disabled={blocked}
        onClick={() => void act(ids, "unsubscribe")}
      />
    </FloatingActionBar>
  );
}

function BlockedState({ offline }: { offline: boolean }) {
  return (
    <div role="status" className="flex flex-col items-center gap-3 py-16 text-center">
      {offline ? (
        <CloudOff className="size-8 text-muted-foreground" />
      ) : (
        <KeyRound className="size-8 text-muted-foreground" />
      )}
      <h2 className="text-heading font-medium">
        {offline ? "You're offline" : "Your GitHub sign-in expired"}
      </h2>
      <p className="max-w-sm text-ui text-muted-foreground">
        {offline
          ? "Notifications load when you reconnect."
          : "Sign in again to load notifications. Your tabs stay as they are."}
      </p>
      {!offline && (
        <Button variant="secondary" onClick={startReauth}>
          Sign in again
        </Button>
      )}
    </div>
  );
}

function CaughtUp({ hiddenUnread, onShowAll }: { hiddenUnread: number; onShowAll: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <CheckCircle2 className="size-8 text-muted-foreground" />
      <h2 className="text-heading font-medium">You're all caught up</h2>
      <p className="max-w-sm text-ui text-muted-foreground">
        {hiddenUnread
          ? `${hiddenUnread} unread in All, from repos you watch.`
          : "New notifications will appear here. Pick up your work or browse your repos."}
      </p>
      <div className="mt-2 flex gap-2">
        {hiddenUnread ? (
          <Button variant="secondary" onClick={onShowAll}>
            Show All
          </Button>
        ) : (
          <Button variant="secondary" asChild>
            <Link to="/" search={{ view: "work" }}>
              Your work
            </Link>
          </Button>
        )}
        <Button
          variant="ghost"
          onClick={() => {
            if (useWorkspaceView.getState().narrow)
              useWorkspaceView.getState().setSidebarOpen(true);
            else useSidebarStore.getState().expand();
            requestAnimationFrame(() => {
              const section = document.getElementById("sidebar-your-repos");
              section?.scrollIntoView({ block: "nearest" });
              (section?.querySelector<HTMLElement>("button") ?? section)?.focus();
            });
          }}
        >
          Your repos
        </Button>
      </div>
    </div>
  );
}

/** Row actions stay out of the way at rest, like the selection checkbox. */
const ROW_ACTION =
  "opacity-0 group-hover/bulk:opacity-100 group-focus-within/bulk:opacity-100 group-data-selected/bulk:opacity-100 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100";

function NotificationRow({
  item,
  unread,
  deviceOnly,
  busy,
  canMutate,
  unavailableReason,
  onAction,
}: {
  item: Notification;
  unread: boolean;
  deviceOnly: boolean;
  busy: boolean;
  canMutate: boolean;
  unavailableReason?: string;
  onAction: (action: NotificationAction) => void;
}) {
  const href = notificationHref(item);
  const scope = useTabScope();
  const bulk = useBulkRow(rowKey(item.id));
  const selecting = useSelection().selected.size > 0;
  const islandId = () =>
    scope.tabId ? findTab(getWorkspace().layout, scope.tabId)?.island.id : undefined;
  const Icon = SUBJECT_ICONS[item.subject.type] ?? Bell;
  const content = (
    <>
      <Icon
        aria-label={item.subject.type}
        className={cn(
          "mt-0.5 size-4 shrink-0",
          unread ? "text-foreground" : "text-muted-foreground",
        )}
      />
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "text-body",
            unread ? "font-[475] text-foreground" : "text-muted-foreground",
          )}
        >
          {item.subject.title}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-ui text-muted-foreground">
          <RepoMark repo={item.repository.full_name} />
          <span className="font-mono">{item.repository.full_name}</span>
          <span>·</span>
          <span>{item.reason.replaceAll("_", " ")}</span>
          <span>·</span>
          <time dateTime={item.updated_at}>{formatRelativeTime(item.updated_at)}</time>
          {deviceOnly && <span>Unread on this device</span>}
        </div>
      </div>
    </>
  );
  const linkProps = {
    "data-keyboard-list-item": true,
    "aria-label": item.subject.title,
    className:
      "flex min-w-0 flex-1 items-start gap-3 rounded-lg py-2.5 pr-2 outline-none focus-visible:ring-1 focus-visible:ring-ring/40",
  };
  return (
    <div
      data-notification-row={item.id}
      data-live-item={item.id}
      {...bulk?.rowProps}
      className={cn(bulk?.className, "flex items-center gap-2 pr-2 pl-10")}
    >
      {unread && (
        <span
          role="img"
          aria-label={deviceOnly ? "Unread on this device" : "Unread"}
          className={cn(
            "absolute top-[1.1rem] left-[1.15rem] size-1.5 rounded-full bg-primary transition-opacity",
            "group-hover/bulk:opacity-0 group-focus-within/bulk:opacity-0 [@media(hover:none)]:hidden",
            selecting && "opacity-0",
          )}
        />
      )}
      <BulkRowCheckbox number={rowKey(item.id)} label={`Select ${item.subject.title}`} />
      {href ? (
        <Link to={href} {...linkProps}>
          {content}
        </Link>
      ) : (
        <a href={notificationGitHubHref(item)} target="_blank" rel="noreferrer" {...linkProps}>
          {content}
        </a>
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        className={ROW_ACTION}
        aria-label={`Done: ${item.subject.title}`}
        title={unavailableReason ?? "Done (e)"}
        disabled={!canMutate || busy}
        onClick={() => onAction("done")}
      >
        <Check />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className={ROW_ACTION}
            aria-label={`Actions for ${item.subject.title}`}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem disabled={!canMutate || busy} onSelect={() => onAction("done")}>
              <Check />
              Done
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={busy || (unread && !canMutate)}
              onSelect={() => onAction(unread ? "read" : "unread")}
            >
              {unread ? <MailOpen /> : <Mail />}
              {unread ? "Mark read" : "Mark unread (device only)"}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!canMutate || busy}
              onSelect={() => onAction("unsubscribe")}
            >
              <BellOff />
              Unsubscribe
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {href && (
              <>
                <DropdownMenuItem onSelect={() => openInNewTab(href, { islandId: islandId() })}>
                  Open in new tab
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => openToSide(href, islandId())}>
                  Open to the side
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem asChild>
              <a href={notificationGitHubHref(item)} target="_blank" rel="noreferrer">
                Open on GitHub
              </a>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
