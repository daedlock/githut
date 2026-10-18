import { useLayoutEffect } from "react";
import { activityPage } from "./pages";
import { acknowledgePage, useTabActivityStore } from "./store";

/** A page's real query result establishes the last head/run state the user saw. */
export function observeVisibleSignal(
  key: string,
  fingerprint: string,
  activityAt: number,
  fetchedAt: number,
) {
  const { account, statuses } = useTabActivityStore.getState();
  if (!account || !fetchedAt || (statuses[key]?.observedAt ?? 0) > fetchedAt) return;
  const previous = statuses[key];
  if (previous?.fingerprint === fingerprint) return;
  useTabActivityStore.setState({
    statuses: {
      ...statuses,
      [key]: {
        key,
        title: "",
        state: "open",
        ci: null,
        activityAt: Math.max(previous?.activityAt ?? 0, activityAt),
        fingerprint,
        observedAt: fetchedAt,
      },
    },
  });
  acknowledgePage(key, Date.now());
}

export function useVisibleSignal(
  href: string,
  fingerprint: string | undefined,
  activityAt: number,
  fetchedAt: number,
) {
  const account = useTabActivityStore((s) => s.account);
  const key = activityPage(href)?.key;
  // Activity disconnects layout effects in background tabs. Reconnecting also
  // records data that was already cached before the page became shown.
  useLayoutEffect(() => {
    if (account && key && fingerprint)
      observeVisibleSignal(key, fingerprint, activityAt, fetchedAt);
  }, [account, key, fingerprint, activityAt, fetchedAt]);
}
