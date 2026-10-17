import { Link } from "@tanstack/react-router";
import {
  BellOff,
  Check,
  CheckCircle2,
  CircleDot,
  GitPullRequest,
  Inbox,
  Mail,
  MailOpen,
  MoreHorizontal,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { LiveUpdates } from "@/app/components/LiveUpdates";
import { RepoMark } from "@/app/components/shell/RepoMark";
import { Button } from "@/app/components/ui/button";
import { Container } from "@/app/components/ui/Container";
import { Checkbox } from "@/app/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { Separator } from "@/app/components/ui/separator";
import { Skeleton, SkeletonGroup } from "@/app/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/app/components/ui/toggle-group";
import { DashboardView } from "@/app/features/dashboard/DashboardView";
import { toggleSelection } from "@/app/features/repo/bulkSelection";
import { useKeybindings } from "@/app/hooks/useKeybindings";
import { useListNavigation } from "@/app/hooks/useListNavigation";
import { useStableList } from "@/app/hooks/useStableList";
import { cn } from "@/app/lib/cn";
import { useCanMutate } from "@/app/lib/connectivity";
import { openInNewTab, openToSide } from "@/app/lib/tabActions";
import { useTabScope } from "@/app/lib/tabScope";
import { formatRelativeTime } from "@/app/lib/time";
import { useSidebarStore } from "@/app/stores/sidebar";
import { useWorkspaceView } from "@/app/stores/workspaceView";
import { findTab, focusedTab } from "@/app/workspace/model";
import { getWorkspace, useWorkspaceStore } from "@/app/workspace/store";
import { type Notification, notificationGitHubHref, notificationHref } from "./api";
import {
  type NotificationAction,
  notificationIsUnread,
  runNotificationAction,
  useNotificationState,
  useNotifications,
} from "./service";

export function InboxPage() {
  const [view, setView] = useState<"inbox" | "your-turn">("inbox");
  const [filter, setFilter] = useState("participating");
  return (
    <div className="min-h-full min-w-0 pb-24">
      <Container className="pt-5">
        <nav aria-label="Home views" className="flex gap-1">
          <Button
            variant={view === "inbox" ? "secondary" : "ghost"}
            aria-pressed={view === "inbox"}
            onClick={() => setView("inbox")}
          >
            <Inbox />
            Inbox
          </Button>
          <Button
            variant={view === "your-turn" ? "secondary" : "ghost"}
            aria-pressed={view === "your-turn"}
            onClick={() => setView("your-turn")}
          >
            Your turn
          </Button>
        </nav>
      </Container>
      {view === "your-turn" ? (
        <DashboardView />
      ) : (
        <InboxList filter={filter} setFilter={setFilter} onYourWork={() => setView("your-turn")} />
      )}
    </div>
  );
}

function InboxList({
  onYourWork,
  filter,
  setFilter,
}: {
  onYourWork: () => void;
  filter: string;
  setFilter: (filter: string) => void;
}) {
  const { data, isPending, isError, error, isFetching } = useNotifications();
  const localUnread = useNotificationState((state) => state.unread);
  const busy = useNotificationState((state) => state.busy);
  const { canMutate, reason } = useCanMutate();
  const scope = useTabScope();
  const workspace = useWorkspaceStore((state) => state.workspace);
  const isFocused = focusedTab(workspace).id === scope.tabId;
  const [selected, setSelected] = useState(new Set<string>());
  const [actionVersion, setActionVersion] = useState(0);
  const [notice, setNotice] = useState<{
    text: string;
    failed?: string[];
    action?: NotificationAction;
  } | null>(null);
  const anchor = useRef<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const incoming =
    data?.items.filter((item) => filter === "all" || data.participatingIds.includes(item.id)) ?? [];
  const { items: rows, listProps } = useStableList(incoming, {
    key: (item) => item.id,
    resetKey: `${filter}:${actionVersion}`,
  });
  const ids = rows.map((item) => item.id);
  useListNavigation(!isPending);
  useEffect(() => {
    setSelected(
      (current) => new Set([...current].filter((id) => data?.items.some((item) => item.id === id))),
    );
  }, [data]);
  function choose(index: number, range = false) {
    setSelected((current) => toggleSelection(current, ids, index, anchor.current, range));
    anchor.current = index;
  }
  function currentIds() {
    if (selected.size) return [...selected];
    const focused = document.activeElement?.closest<HTMLElement>("[data-notification-row]");
    return focused && root.current?.contains(focused) ? [focused.dataset.notificationRow!] : [];
  }
  async function act(targets: string[], action: NotificationAction) {
    if (!targets.length || (action !== "unread" && !canMutate)) return;
    setNotice(null);
    try {
      const result = await runNotificationAction(targets, action);
      setActionVersion((version) => version + 1);
      const failed = result.failed.map((item) => item.id);
      if (failed.length) {
        setSelected(new Set(failed));
        setNotice({
          text: `${result.succeeded.length ? `${result.succeeded.length} updated. ` : ""}Could not update ${failed.length} notification${failed.length === 1 ? "" : "s"}. ${result.failed[0]?.message ?? ""}`,
          failed,
          action,
        });
      } else {
        if (action === "done") setSelected(new Set());
        const verb =
          action === "done"
            ? "Done"
            : action === "read"
              ? "Marked read"
              : action === "unread"
                ? "Marked unread on this device only"
                : "Unsubscribed from future notifications";
        setNotice({
          text: `${verb}${result.succeeded.length > 1 ? ` · ${result.succeeded.length} notifications` : ""}.`,
        });
      }
    } catch (error) {
      setNotice({
        text: error instanceof Error ? error.message : "Could not update notifications",
        failed: targets,
        action,
      });
    }
  }
  const toggleRead = (targets: string[]) => {
    const unread = targets.some((id) =>
      data?.items.some((item) => item.id === id && notificationIsUnread(item)),
    );
    void act(targets, unread ? "read" : "unread");
  };
  useKeybindings({
    e: () => {
      void act(currentIds(), "done");
    },
    "shift+u": () => toggleRead(currentIds()),
    "shift+x": () => {
      const focused = document.activeElement?.closest<HTMLElement>("[data-notification-row]");
      if (focused) choose(ids.indexOf(focused.dataset.notificationRow!), true);
    },
    x: () => {
      const focused = document.activeElement?.closest<HTMLElement>("[data-notification-row]");
      if (focused) choose(ids.indexOf(focused.dataset.notificationRow!));
    },
    "⌘a": () => setSelected(new Set(ids)),
    Escape: () => setSelected(new Set()),
  });
  return (
    <Container className="pt-6">
      <div ref={root}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <h1 className="text-heading font-semibold">Inbox</h1>
            {data && (
              <span className="text-caption tabular-nums text-muted-foreground">{rows.length}</span>
            )}
          </div>
          <ToggleGroup
            type="single"
            size="sm"
            value={filter}
            onValueChange={(value) => {
              if (value) {
                setFilter(value);
                setSelected(new Set());
                anchor.current = null;
              }
            }}
            aria-label="Notification filter"
          >
            <ToggleGroupItem value="participating">Participating</ToggleGroupItem>
            <ToggleGroupItem value="all">All</ToggleGroupItem>
          </ToggleGroup>
        </div>
        {isError && (
          <p role="status" className="mb-4 text-caption text-destructive">
            {data ? "Notifications could not refresh. " : "Could not load notifications. "}
            {error.message} {isFetching ? "Retrying…" : "We'll retry when GitHub is available."}
          </p>
        )}
        {isPending ? (
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
        ) : !rows.length && !isError ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <CheckCircle2 className="size-8 text-muted-foreground" />
            <h2 className="text-heading font-medium">You're all caught up</h2>
            <p className="max-w-sm text-ui text-muted-foreground">
              New notifications will appear here. Pick up your work or browse your repos.
            </p>
            <div className="mt-2 flex gap-2">
              <Button variant="secondary" onClick={onYourWork}>
                Your work
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  if (useWorkspaceView.getState().narrow)
                    useWorkspaceView.getState().setSidebarOpen(true);
                  else useSidebarStore.getState().resize(useSidebarStore.getState().width);
                  requestAnimationFrame(() => {
                    const section = document.querySelector<HTMLElement>(
                      '[aria-label="Your repos"]',
                    );
                    section?.scrollIntoView({ block: "nearest" });
                    (section?.querySelector<HTMLElement>("button") ?? section)?.focus();
                  });
                }}
              >
                Your repos
              </Button>
            </div>
          </div>
        ) : (
          <LiveUpdates ready={!isPending} announce={false}>
            <section aria-label="Notifications" {...listProps}>
              {rows.map((item, index) => (
                <NotificationRow
                  key={item.id}
                  item={item}
                  unread={item.unread || !!localUnread[item.id]}
                  deviceOnly={!!localUnread[item.id] && !item.unread}
                  selected={selected.has(item.id)}
                  busy={busy.includes(item.id)}
                  canMutate={canMutate}
                  unavailableReason={reason}
                  onSelect={(range) => choose(index, range)}
                  onAction={(action) => {
                    void act([item.id], action);
                  }}
                />
              ))}
            </section>
          </LiveUpdates>
        )}
        {notice && (
          <div
            role="status"
            className="mt-4 flex flex-wrap items-center gap-2 text-caption text-muted-foreground"
          >
            <span>{notice.text}</span>
            {notice.failed && (
              <Button
                size="sm"
                variant="ghost"
                disabled={!canMutate && notice.action !== "unread"}
                onClick={() => {
                  void act(notice.failed!, notice.action!);
                }}
              >
                Retry failed
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Dismiss notification message"
              onClick={() => setNotice(null)}
            >
              <X />
            </Button>
          </div>
        )}
      </div>
      {selected.size > 0 && isFocused && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-40 flex justify-center px-4">
          <div
            role="toolbar"
            aria-label="Notification bulk actions"
            className="pointer-events-auto flex h-11 max-w-full items-center gap-1 overflow-x-auto rounded-xl bg-popover p-1.5 text-popover-foreground shadow-lg ring-1 ring-foreground/10"
          >
            <Checkbox
              className="mx-2"
              aria-label="Select all notifications"
              checked={selected.size === rows.length ? true : "indeterminate"}
              onCheckedChange={(checked) => setSelected(checked ? new Set(ids) : new Set())}
            />
            <span className="mr-2 whitespace-nowrap text-caption tabular-nums">
              {selected.size} selected
            </span>
            <Separator orientation="vertical" className="mx-1 h-5" />
            <Button
              variant="ghost"
              size="sm"
              disabled={!canMutate || busy.length > 0}
              title={reason}
              onClick={() => {
                void act([...selected], "done");
              }}
            >
              <Check />
              Done
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={!canMutate || busy.length > 0}
              title={reason}
              onClick={() => {
                void act([...selected], "read");
              }}
            >
              <MailOpen />
              Read
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy.length > 0}
              onClick={() => {
                void act([...selected], "unread");
              }}
            >
              <Mail />
              Unread (device only)
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={!canMutate || busy.length > 0}
              title={reason}
              onClick={() => {
                void act([...selected], "unsubscribe");
              }}
            >
              <BellOff />
              Unsubscribe
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Clear notification selection"
              onClick={() => setSelected(new Set())}
            >
              <X />
            </Button>
          </div>
        </div>
      )}
    </Container>
  );
}

function NotificationRow({
  item,
  unread,
  deviceOnly,
  selected,
  busy,
  canMutate,
  unavailableReason,
  onSelect,
  onAction,
}: {
  item: Notification;
  unread: boolean;
  deviceOnly: boolean;
  selected: boolean;
  busy: boolean;
  canMutate: boolean;
  unavailableReason?: string;
  onSelect: (range: boolean) => void;
  onAction: (action: NotificationAction) => void;
}) {
  const href = notificationHref(item);
  const scope = useTabScope();
  const islandId = () =>
    scope.tabId ? findTab(getWorkspace().layout, scope.tabId)?.island.id : undefined;
  const Icon = item.subject.type === "PullRequest" ? GitPullRequest : CircleDot;
  const content = (
    <>
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          unread ? "text-foreground" : "text-muted-foreground",
        )}
      />
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "text-body",
            unread ? "font-medium text-foreground" : "text-muted-foreground",
          )}
        >
          {item.subject.title}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-muted-foreground">
          <RepoMark repo={item.repository.full_name} />
          <span className="font-mono">{item.repository.full_name}</span>
          <span>·</span>
          <span>{item.reason.replaceAll("_", " ")}</span>
          <span>·</span>
          <time dateTime={item.updated_at}>{formatRelativeTime(item.updated_at)}</time>
          {deviceOnly && <span>Unread on this device</span>}
        </div>
      </div>
      {unread && (
        <span
          role="img"
          aria-label={deviceOnly ? "Unread on this device" : "Unread"}
          className="mt-2 size-1.5 shrink-0 rounded-full bg-primary"
        />
      )}
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
      className={cn(
        "group flex items-center gap-2 rounded-lg px-2 hover:bg-muted",
        selected && "bg-accent",
      )}
    >
      <Checkbox
        aria-label={`Select ${item.subject.title}`}
        checked={selected}
        onClick={(event) => {
          event.preventDefault();
          onSelect(event.shiftKey);
        }}
        className="mx-1 shrink-0"
      />
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
        aria-label={`Done: ${item.subject.title}`}
        title={unavailableReason ?? "Done (e)"}
        disabled={!canMutate || busy}
        onClick={() => onAction("done")}
      >
        <Check />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${item.subject.title}`}>
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
