import { onlineManager } from "@tanstack/react-query";
import { issueKeys } from "@/app/features/issues/hooks";
import {
  type NotificationFeed,
  notificationHref,
  notificationPageKey,
} from "@/app/features/notifications/api";
import {
  NOTIFICATIONS_KEY,
  notificationIsUnread,
  useNotificationState,
} from "@/app/features/notifications/service";
import { pullsKeys } from "@/app/features/pulls/hooks";
import { queryClient, subscribeQueryData } from "@/app/lib/query";
import { useAuthStore } from "@/app/stores/auth";
import { getRateBackoff, useRateLimitStore } from "@/app/stores/rateLimit";
import { useWorkspaceView } from "@/app/stores/workspaceView";
import { focusedTab, islands } from "@/app/workspace/model";
import { useWorkspaceStore } from "@/app/workspace/store";
import { visibleTabIds } from "@/app/workspace/view";
import { fetchTabStatuses, pageEntity, STATUS_BATCH_SIZE } from "./api";
import {
  acknowledgePage as acknowledgeStoredPage,
  publishStatuses,
  useTabActivityStore,
} from "./store";

type Session = {
  token: string;
  attempts: Map<string, number>;
  views: Map<string, number>;
  notifications: Set<string>;
  /** The focused page being viewed (`tabId:pageKey`), its page key, and the last time it was seen on screen. */
  visit: string | null;
  visitPage: string | null;
  visitSeenAt: number;
  /** Start of the last background status round; every background page shares one cadence. */
  roundAt: number;
  controller: AbortController;
  identityAt: number;
  pending?: Promise<void>;
};
let session: Session | undefined;
const windowVisible = () => typeof document === "undefined" || !document.hidden;
const canRefresh = () =>
  windowVisible() &&
  onlineManager.isOnline() &&
  (typeof navigator === "undefined" || navigator.onLine !== false) &&
  !!useAuthStore.getState().token &&
  !useAuthStore.getState().expired;

function currentSession(): Session | undefined {
  const token = useAuthStore.getState().token;
  if (session?.token !== token) {
    session?.controller.abort();
    session = token
      ? {
          token,
          attempts: new Map(),
          views: new Map(),
          notifications: new Set(),
          visit: null,
          visitPage: null,
          visitSeenAt: 0,
          roundAt: 0,
          controller: new AbortController(),
          identityAt: 0,
        }
      : undefined;
    useTabActivityStore.setState({ account: null, statuses: {} });
  }
  return session;
}

function backgroundPages() {
  const { workspace } = useWorkspaceStore.getState();
  const shown = visibleTabIds(workspace, useWorkspaceView.getState().narrow);
  const tabs = islands(workspace.layout).flatMap((island) => island.tabs);
  const visiblePages = new Set(
    tabs.filter((tab) => shown.has(tab.id)).map((tab) => notificationPageKey(tab.href)),
  );
  return [
    ...new Map(
      tabs.flatMap((tab) => {
        const page = pageEntity(tab.href);
        return page && !visiblePages.has(page.key) ? [[page.key, page] as const] : [];
      }),
    ).values(),
  ];
}

function detailKey(key: string) {
  const page = pageEntity(key);
  if (!page) return null;
  return page.kind === "issue"
    ? issueKeys.detail(page.owner, page.repo, page.number)
    : pullsKeys.detail(page.owner, page.repo, page.number);
}

/** Visible duplicates already refresh their details through their own live queries. */
function cachedActivity(key: string): number {
  const queryKey = detailKey(key);
  if (!queryKey) return 0;
  const cached = queryClient.getQueryData<{ updated_at?: string }>(queryKey);
  const at = cached?.updated_at ? Date.parse(cached.updated_at) : 0;
  return Number.isFinite(at) ? at : 0;
}

/** When the page's details were last fetched, by its own page or by this watcher. */
function lastObserved(active: Session, key: string): number {
  const queryKey = detailKey(key);
  const fetched = queryKey ? (queryClient.getQueryState(queryKey)?.dataUpdatedAt ?? 0) : 0;
  return Math.max(active.attempts.get(key) ?? 0, fetched);
}

function acknowledgePage(key: string, at: number) {
  acknowledgeStoredPage(key, Math.max(at, cachedActivity(key)));
}

/**
 * The focused page is being read: everything that lands on it while it is
 * focused (including your own comments) is seen as it arrives, and leaving
 * it acknowledges everything up to the last moment it was on screen.
 */
function recordView(active: Session, now: number) {
  const { workspace } = useWorkspaceStore.getState();
  const tab = focusedTab(workspace);
  const page = pageEntity(tab.href);
  const viewing =
    windowVisible() &&
    !!page &&
    visibleTabIds(workspace, useWorkspaceView.getState().narrow).has(tab.id);
  const visit = viewing && page ? `${tab.id}:${page.key}` : null;
  if (active.visit && active.visit !== visit && active.visitPage) {
    // Not the cached details: they may already hold activity that landed after leaving.
    active.views.set(active.visitPage, active.visitSeenAt);
    acknowledgeStoredPage(active.visitPage, active.visitSeenAt);
  }
  if (!visit || !page) {
    active.visit = null;
    active.visitPage = null;
    return;
  }
  if (active.visit !== visit) {
    active.visit = visit;
    active.visitPage = page.key;
    active.visitSeenAt = now;
    active.views.set(page.key, now);
    acknowledgePage(page.key, now);
    return;
  }
  active.visitSeenAt = Math.max(active.visitSeenAt, now);
  // Only writes when newer activity was observed (the page's own live queries).
  acknowledgePage(page.key, 0);
}

let notificationIndex:
  | { items: NotificationFeed["items"]; unread: Record<string, true>; pages: Map<string, boolean> }
  | undefined;

/** Reuse one index across tab subscribers; unrelated cache updates need no feed scan. */
function notificationPages(): Map<string, boolean> | undefined {
  const feed = queryClient.getQueryData<NotificationFeed>(NOTIFICATIONS_KEY);
  if (!feed) return undefined;
  const unread = useNotificationState.getState().unread;
  if (notificationIndex?.items === feed.items && notificationIndex.unread === unread)
    return notificationIndex.pages;
  const pages = new Map<string, boolean>();
  for (const item of feed.items) {
    const href = notificationHref(item);
    if (!href) continue;
    const key = notificationPageKey(href);
    pages.set(key, !!pages.get(key) || notificationIsUnread(item));
  }
  notificationIndex = { items: feed.items, unread, pages };
  return pages;
}

/** Shared notification read state wins over the local fallback, including device-only unread. */
export function pageIsUnread(href: string): boolean {
  const key = notificationPageKey(href);
  const pages = notificationPages();
  if (pages?.has(key)) return pages.get(key)!;
  const { account, statuses, seen } = useTabActivityStore.getState();
  return (
    !!account &&
    Math.max(statuses[key]?.activityAt ?? 0, cachedActivity(key)) >
      (seen[account]?.[key] ?? Infinity)
  );
}

function reconcileNotifications(active: Session, now: number) {
  const pages = notificationPages();
  if (!pages) return;
  for (const [key, unread] of pages) if (!unread) acknowledgePage(key, 0);
  // Done removes a thread from the feed. A local fallback must not resurrect its dot.
  for (const key of active.notifications)
    if (!pages.has(key)) {
      // Preserve the acknowledgement even before the first response identifies
      // the viewer; otherwise a late batch could revive an optimistically Done dot.
      active.views.set(key, now);
      acknowledgePage(key, now);
    }
  active.notifications = new Set(pages.keys());
}

/** One bounded batch coordinator, separate from all detailed-page query timestamps. */
export async function refreshBackgroundTabs(now = Date.now()): Promise<void> {
  const active = currentSession();
  if (!active) return;
  recordView(active, now);
  reconcileNotifications(active, now);
  if (!canRefresh()) return;
  if (active.pending) {
    await active.pending;
    return;
  }
  const cadence = 60_000 * getRateBackoff("graphql", now);
  // One round per cadence covers every background page in as few batches as
  // possible. A page whose details were fetched within the last half cadence
  // (it was on screen moments ago) waits for the next round.
  const round = now - active.roundAt >= cadence;
  if (round) active.roundAt = now;
  const due = round
    ? backgroundPages().filter((page) => now - lastObserved(active, page.key) >= cadence / 2)
    : [];
  // A window containing only visible copies still needs a verified account
  // for local read history; this small identity read runs once, not every tick.
  const identify =
    !useTabActivityStore.getState().account &&
    now - active.identityAt >= cadence &&
    islands(useWorkspaceStore.getState().workspace.layout).some((island) =>
      island.tabs.some((tab) => pageEntity(tab.href)),
    );
  if (!due.length && !identify) return;
  active.pending = (async () => {
    for (
      let offset = 0;
      offset < Math.max(due.length, identify ? 1 : 0);
      offset += STATUS_BATCH_SIZE
    ) {
      if (session !== active || useAuthStore.getState().token !== active.token || !canRefresh())
        break;
      const eligible = new Set(backgroundPages().map((page) => page.key));
      const batch = due
        .slice(offset, offset + STATUS_BATCH_SIZE)
        .filter((page) => eligible.has(page.key));
      // The identity read rides on the first batch only; never send empty batches after it.
      if (!batch.length && !(identify && offset === 0)) continue;
      active.identityAt = now;
      for (const page of batch) active.attempts.set(page.key, now);
      try {
        const result = await fetchTabStatuses(batch, active.controller.signal);
        if (
          session !== active ||
          useAuthStore.getState().token !== active.token ||
          useAuthStore.getState().expired
        )
          break;
        recordView(active, now);
        publishStatuses(result.account, result.items, now, active.views);
        reconcileNotifications(active, now);
      } catch {
        // Retain the last successful metadata; retry on the next ordinary cadence.
      }
    }
  })();
  try {
    await active.pending;
  } finally {
    active.pending = undefined;
  }
}

/** Mount once, outside per-tab providers. It observes the existing notification cache. */
export function startBackgroundWatcher(): () => void {
  let stopped = false;
  let queued = false;
  const refresh = () => {
    if (stopped || queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      if (!stopped) void refreshBackgroundTabs();
    });
  };
  const timer = setInterval(refresh, 1000);
  const cleanups = [
    useWorkspaceStore.subscribe(refresh),
    useWorkspaceView.subscribe(refresh),
    useAuthStore.subscribe(refresh),
    useNotificationState.subscribe(refresh),
    useRateLimitStore.subscribe(refresh),
    subscribeQueryData(refresh),
    onlineManager.subscribe(refresh),
  ];
  document.addEventListener("visibilitychange", refresh);
  refresh();
  return () => {
    stopped = true;
    clearInterval(timer);
    cleanups.forEach((stop) => {
      stop();
    });
    document.removeEventListener("visibilitychange", refresh);
  };
}
