import { isCancelledError, useQuery } from "@tanstack/react-query";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { assertCanMutate } from "@/app/lib/connectivity";
import { getGitHubClient } from "@/app/lib/github/client";
import { queryClient } from "@/app/lib/query";
import { accountStorage, followDraftAccount } from "@/app/stores/accountStorage";
import { useAuthStore } from "@/app/stores/auth";
import { getRateBackoff } from "@/app/stores/rateLimit";
import {
  appendPage,
  fetchNotificationPage,
  isParticipating,
  mergeFirstPage,
  type Notification,
  type NotificationFeed,
} from "./api";

export const NOTIFICATIONS_KEY = ["notifications", "workspace"] as const;
export type NotificationAction = "read" | "unread" | "done" | "unsubscribe";
export type NotificationResult = {
  succeeded: string[];
  failed: Array<{ id: string; message: string }>;
};

/** Overrides contain thread IDs only, and never change GitHub's read state. */
type NotificationState = { unread: Record<string, true>; busy: string[] };
export const useNotificationState = create<NotificationState>()(
  persist((): NotificationState => ({ unread: {}, busy: [] }), {
    name: "githut.notifications",
    // Thread IDs reveal which private threads an account follows.
    storage: accountStorage<Pick<NotificationState, "unread">>(),
    partialize: (state) => ({ unread: state.unread }),
  }),
);
followDraftAccount(() => useNotificationState.persist.rehydrate());

export function notificationIsUnread(item: Notification): boolean {
  return item.unread || !!useNotificationState.getState().unread[item.id];
}

/** A poll asks for page 1 only and keeps any older pages already loaded. */
async function pollFirstPage(signal?: AbortSignal): Promise<NotificationFeed> {
  const first = await fetchNotificationPage(1, signal);
  return mergeFirstPage(first, queryClient.getQueryData<NotificationFeed>(NOTIFICATIONS_KEY));
}

/** Consumers observe the same cache without starting another polling loop. */
export function useNotifications() {
  return useQuery(
    {
      queryKey: NOTIFICATIONS_KEY,
      queryFn: ({ signal }) => pollFirstPage(signal),
      enabled: false,
    },
    queryClient,
  );
}

/** Counts what the Inbox opens on (Participating), so the sidebar and list agree. */
export function useNotificationUnreadCount(
  filter: "participating" | "all" = "participating",
): number {
  const { data } = useNotifications();
  const unread = useNotificationState((state) => state.unread);
  return (
    data?.items.filter(
      (item) => (filter === "all" || isParticipating(item)) && (item.unread || unread[item.id]),
    ).length ?? 0
  );
}

let loadingMore: Promise<void> | undefined;

/** The Inbox's "Load more": one older page, on request, never polled. */
export function loadMoreNotifications(): Promise<void> {
  loadingMore ??= (async () => {
    const feed = queryClient.getQueryData<NotificationFeed>(NOTIFICATIONS_KEY);
    if (!feed?.hasMore) return;
    const token = useAuthStore.getState().token;
    const next = await fetchNotificationPage(feed.pages + 1);
    if (useAuthStore.getState().token !== token) return;
    queryClient.setQueryData<NotificationFeed>(
      NOTIFICATIONS_KEY,
      (current) => current && appendPage(current, next),
    );
  })().finally(() => {
    loadingMore = undefined;
  });
  return loadingMore;
}

let poll: { token: string; at: number; promise?: Promise<unknown> } | undefined;

/** Shared by the visible-window owner and future notification watchers. */
export async function refreshNotifications(now = Date.now()): Promise<void> {
  const { token, expired } = useAuthStore.getState();
  if (useNotificationState.getState().busy.length) return;
  if (
    !token ||
    expired ||
    (typeof document !== "undefined" && document.hidden) ||
    (typeof navigator !== "undefined" && navigator.onLine === false)
  )
    return;
  const existing = queryClient.getQueryState<NotificationFeed>(NOTIFICATIONS_KEY);
  if (poll?.token !== token || !existing) poll = undefined;
  if (poll?.promise) {
    await poll.promise;
    return;
  }
  const interval = (existing?.data?.pollInterval ?? 60_000) * getRateBackoff(now);
  const last = poll?.at ?? existing?.dataUpdatedAt ?? 0;
  if (last && now - last < interval) return;
  const attempt = { token, at: now, promise: undefined as Promise<unknown> | undefined };
  poll = attempt;
  attempt.promise = queryClient.fetchQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: ({ signal }) => pollFirstPage(signal),
    staleTime: 0,
    retry: false,
  });
  try {
    await attempt.promise;
  } catch (error) {
    if (isCancelledError(error) && poll === attempt) poll = undefined;
    throw error;
  } finally {
    attempt.promise = undefined;
  }
}

/** Mount exactly once for a workspace, outside the individual tab providers. */
export function startNotificationPolling(): () => void {
  const refresh = () => {
    void refreshNotifications().catch(() => {});
  };
  refresh();
  const timer = setInterval(refresh, 1000);
  document.addEventListener("visibilitychange", refresh);
  window.addEventListener("online", refresh);
  const stopAuth = useAuthStore.subscribe(refresh);
  return () => {
    clearInterval(timer);
    document.removeEventListener("visibilitychange", refresh);
    window.removeEventListener("online", refresh);
    stopAuth();
  };
}

/** Optimistic per-thread updates, with rollback limited to the failed IDs. */
export async function runNotificationAction(
  ids: string[],
  action: NotificationAction,
): Promise<NotificationResult> {
  if (action !== "unread") assertCanMutate();
  const token = useAuthStore.getState().token;
  await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_KEY });
  if (useAuthStore.getState().token !== token)
    throw new Error("Session changed. Try again in the current account.");
  const before = queryClient.getQueryData<NotificationFeed>(NOTIFICATIONS_KEY);
  const previousUnread = useNotificationState.getState().unread;
  const busy = new Set(useNotificationState.getState().busy);
  const targets = [...new Set(ids)].filter((id) => !busy.has(id));
  const result: NotificationResult = { succeeded: [], failed: [] };
  if (!targets.length) return result;
  useNotificationState.setState((state) => {
    const unread = { ...state.unread };
    for (const id of targets) {
      if (action === "unread") unread[id] = true;
      else if (action !== "unsubscribe") delete unread[id];
    }
    return { unread, busy: [...state.busy, ...targets] };
  });
  const targetSet = new Set(targets);
  if (action === "read" || action === "done")
    queryClient.setQueryData<NotificationFeed>(
      NOTIFICATIONS_KEY,
      (current) =>
        current && {
          ...current,
          items:
            action === "done"
              ? current.items.filter((item) => !targetSet.has(item.id))
              : current.items.map((item) =>
                  targetSet.has(item.id) ? { ...item, unread: false } : item,
                ),
        },
    );
  let cursor = 0;
  const worker = async () => {
    while (cursor < targets.length) {
      const id = targets[cursor++]!;
      try {
        if (useAuthStore.getState().token !== token)
          throw new Error("Session changed. Try again in the current account.");
        if (action !== "unread") {
          const client = getGitHubClient();
          const path = `/notifications/threads/${encodeURIComponent(id)}`;
          if (action === "read") await client.request(`PATCH ${path}`);
          else if (action === "done") await client.request(`DELETE ${path}`);
          // GitHub's Unsubscribe: quiet until you're mentioned or comment again.
          // (`ignored: true` would block those too.)
          else await client.request(`DELETE ${path}/subscription`);
        }
        result.succeeded.push(id);
      } catch (error) {
        result.failed.push({
          id,
          message: error instanceof Error ? error.message : "Could not update notification",
        });
        if (useAuthStore.getState().token !== token) continue;
        const original = before?.items.find((item) => item.id === id);
        if (original && (action === "done" || action === "read"))
          queryClient.setQueryData<NotificationFeed>(NOTIFICATIONS_KEY, (current) => {
            if (!current) return current;
            const items = current.items.filter((item) => item.id !== id);
            const index = before?.items.findIndex((item) => item.id === id) ?? items.length;
            items.splice(Math.min(index, items.length), 0, original);
            return { ...current, items };
          });
        if (previousUnread[id])
          useNotificationState.setState((state) => ({ unread: { ...state.unread, [id]: true } }));
      } finally {
        useNotificationState.setState((state) => ({
          busy: state.busy.filter((item) => item !== id),
        }));
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, targets.length) }, worker));
  return result;
}
