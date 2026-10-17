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
  type UnreadOverrides,
  useNotificationState,
} from "@/app/features/notifications/service";
import { pullsKeys } from "@/app/features/pulls/hooks";
import { queryClient } from "@/app/lib/query";
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
  visit: string | null;
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

/** Visible duplicates already refresh their details through the page scheduler. */
function cachedActivity(key: string): number {
  const page = pageEntity(key);
  if (!page) return 0;
  const queryKey =
    page.kind === "issue"
      ? issueKeys.detail(page.owner, page.repo, page.number)
      : pullsKeys.detail(page.owner, page.repo, page.number);
  const cached = queryClient.getQueryData<{ updated_at?: string }>(queryKey);
  const at = cached?.updated_at ? Date.parse(cached.updated_at) : 0;
  return Number.isFinite(at) ? at : 0;
}

function acknowledgePage(key: string, at: number) {
  acknowledgeStoredPage(key, Math.max(at, cachedActivity(key)));
}

function recordView(active: Session, now: number) {
  const { workspace } = useWorkspaceStore.getState();
  const tab = focusedTab(workspace);
  const page = pageEntity(tab.href);
  if (
    !windowVisible() ||
    !page ||
    !visibleTabIds(workspace, useWorkspaceView.getState().narrow).has(tab.id)
  ) {
    active.visit = null;
    return;
  }
  const visit = `${tab.id}:${page.key}`;
  if (active.visit === visit) return;
  active.visit = visit;
  active.views.set(page.key, now);
  acknowledgePage(page.key, now);
}

let notificationIndex:
  | { items: NotificationFeed["items"]; unread: UnreadOverrides; pages: Map<string, boolean> }
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
  const due = backgroundPages().filter(
    (page) => now - (active.attempts.get(page.key) ?? 0) >= 60_000 * getRateBackoff(now),
  );
  // A window containing only visible copies still needs a verified account
  // for local read history; this small identity read runs once, not every tick.
  const identify =
    !useTabActivityStore.getState().account &&
    now - active.identityAt >= 60_000 * getRateBackoff(now) &&
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
        .filter(
          (page) =>
            eligible.has(page.key) &&
            now - (active.attempts.get(page.key) ?? 0) >= 60_000 * getRateBackoff(now),
        );
      if (!batch.length && !identify) continue;
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
    queryClient.getQueryCache().subscribe(refresh),
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
