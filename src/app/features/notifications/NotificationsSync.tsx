import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/app/components/ui/button";
import { useCanMutate } from "@/app/lib/connectivity";
import { useWorkspaceView } from "@/app/stores/workspaceView";
import { focusedTab } from "@/app/workspace/model";
import { useWorkspaceStore } from "@/app/workspace/store";
import { visibleTabIds } from "@/app/workspace/view";
import { notificationHref, notificationPageKey } from "./api";
import {
  notificationIsUnread,
  runNotificationAction,
  startNotificationPolling,
  useNotifications,
} from "./service";

const subscribeVisibility = (changed: () => void) => {
  document.addEventListener("visibilitychange", changed);
  return () => document.removeEventListener("visibilitychange", changed);
};

/** Only actual focused-page visits mark a thread read, never cache rerenders. */
export function NotificationsSync() {
  const workspace = useWorkspaceStore((state) => state.workspace);
  const tab = focusedTab(workspace);
  const narrow = useWorkspaceView((state) => state.narrow);
  const feed = useNotifications();
  const { canMutate } = useCanMutate();
  const visible = useSyncExternalStore(subscribeVisibility, () => !document.hidden);
  const pageVisible = visible && visibleTabIds(workspace, narrow).has(tab.id);
  const visited = useRef<string | null>(null);
  const [failed, setFailed] = useState<string[]>([]);
  const page = notificationPageKey(tab.href);
  const key = `${tab.id}:${page}`;
  useEffect(startNotificationPolling, []);
  useEffect(() => {
    if (!pageVisible) {
      visited.current = null;
      return;
    }
    if (!canMutate || !feed.data || visited.current === key) return;
    visited.current = key;
    if (!/^\/[^/]+\/[^/]+\/(pull|issues)\/\d+$/.test(page)) return;
    const ids = feed.data.items
      .filter((item) => {
        const href = notificationHref(item);
        return href && notificationPageKey(href) === page && notificationIsUnread(item);
      })
      .map((item) => item.id);
    if (ids.length)
      void runNotificationAction(ids, "read")
        .then((result) => setFailed(result.failed.map((item) => item.id)))
        .catch(() => setFailed(ids));
  }, [pageVisible, canMutate, feed.data, key, page]);
  if (!failed.length) return null;
  return (
    <div
      role="status"
      className="absolute bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-xl bg-popover p-2 text-caption text-popover-foreground shadow-lg ring-1 ring-foreground/10"
    >
      Could not mark this notification read.
      <Button
        size="sm"
        variant="ghost"
        disabled={!canMutate}
        onClick={() => {
          void runNotificationAction(failed, "read")
            .then((result) => setFailed(result.failed.map((item) => item.id)))
            .catch(() => {});
        }}
      >
        Retry
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setFailed([])}>
        Dismiss
      </Button>
    </div>
  );
}
