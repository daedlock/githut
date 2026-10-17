/**
 * Recent-items MRU store — IndexedDB-backed via idb-keyval.
 *
 * Why here (not in a data hook): this is client-side UI state that outlives
 * any single page mount but isn't server data. TanStack Query would be the
 * wrong bucket (no server to revalidate against) and Zustand would reset on
 * reload. idb-keyval gives us persistence with ~20 lines of code.
 *
 * Shape is stable across kinds so every palette row can be rendered by one
 * Recent section regardless of what originated it. Capped at 20 entries in
 * storage; callers typically render the top 5.
 */
import { get, set } from "idb-keyval";

export type RecentKind = "repo" | "issue" | "pr" | "file" | "action" | "page";

export type RecentItem = {
  id: string;
  kind: RecentKind;
  label: string;
  href: string;
  meta?: string;
  visitedAt: number;
};

const KEY = "githut.recent-items.v1";
const STORAGE_CAP = 20;

// In-memory mirror. idb-keyval returns Promises; the palette needs sync reads
// to render without a flash. We warm this on first `getRecentItems()` and
// keep it in sync on every push. Subscribers are notified when it mutates so
// the palette re-renders without prop drilling.
// EMPTY is a stable reference — useSyncExternalStore compares snapshots by
// identity, so returning `[]` literals here would loop forever. Same reason
// cache is seeded to EMPTY on first read.
const EMPTY: readonly RecentItem[] = Object.freeze([]);
let cache: RecentItem[] = EMPTY as RecentItem[];
let loading: Promise<RecentItem[]> | null = null;
const subscribers = new Set<() => void>();

async function loadOnce(): Promise<RecentItem[]> {
  if (cache !== (EMPTY as RecentItem[])) return cache;
  if (loading) return loading;
  loading = (async () => {
    const stored = (await get<RecentItem[]>(KEY)) ?? [];
    cache = Array.isArray(stored) && stored.length > 0 ? stored : (EMPTY as RecentItem[]);
    return cache;
  })();
  return loading;
}

function notify() {
  for (const fn of subscribers) fn();
}

export async function hydrateRecentItems(): Promise<RecentItem[]> {
  const items = await loadOnce();
  notify();
  return items;
}

export function getRecentItemsSync(): RecentItem[] {
  return cache;
}

export function subscribeRecentItems(fn: () => void): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

export async function pushRecentItem(item: Omit<RecentItem, "visitedAt">): Promise<void> {
  const current = await loadOnce();
  // A palette result and a focused-page visit can use different ids for the
  // same URL. Both represent one page in Recent.
  const next: RecentItem[] = [
    { ...item, visitedAt: Date.now() },
    ...current.filter((x) => x.id !== item.id && x.href !== item.href),
  ].slice(0, STORAGE_CAP);
  cache = next;
  notify();
  await set(KEY, next);
}

export async function clearRecentItems(): Promise<void> {
  cache = EMPTY as RecentItem[];
  notify();
  await set(KEY, []);
}
