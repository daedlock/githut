/**
 * Recent-items MRU store — IndexedDB-backed via idb-keyval.
 *
 * Why here (not in a data hook): this is client-side UI state that outlives
 * any single page mount but isn't server data. TanStack Query would be the
 * wrong bucket (no server to revalidate against) and Zustand would reset on
 * reload. idb-keyval gives us persistence with ~20 lines of code.
 *
 * Entries hold private page titles, so they belong to one verified account:
 * each account has its own key, nothing is read or written until the account
 * is verified, and signing out deletes that account's list.
 *
 * Shape is stable across kinds so every palette row can be rendered by one
 * Recent section regardless of what originated it. Capped at 20 entries in
 * storage; callers typically render the top 5.
 */
import { del, get, set } from "idb-keyval";
import { useAuthStore } from "@/app/stores/auth";

export type RecentKind = "repo" | "issue" | "pr" | "file" | "action" | "page";

export type RecentItem = {
  id: string;
  kind: RecentKind;
  label: string;
  href: string;
  meta?: string;
  visitedAt: number;
};

/** Before per-account keys; unowned, so it is deleted rather than migrated. */
const LEGACY_KEY = "githut.recent-items.v1";
const STORAGE_CAP = 20;

const keyFor = (accountId: number) => `${LEGACY_KEY}.account.${accountId}`;

// In-memory mirror. idb-keyval returns Promises; the palette needs sync reads
// to render without a flash. We warm this on first `getRecentItems()` and
// keep it in sync on every push. Subscribers are notified when it mutates so
// the palette re-renders without prop drilling.
// EMPTY is a stable reference — useSyncExternalStore compares snapshots by
// identity, so returning `[]` literals here would loop forever.
const EMPTY: readonly RecentItem[] = Object.freeze([]);
let cache: RecentItem[] = EMPTY as RecentItem[];
/** The account `cache` belongs to; `undefined` until a load starts. */
let owner: number | null | undefined;
let loading: Promise<RecentItem[]> | null = null;
const subscribers = new Set<() => void>();

function notify() {
  for (const fn of subscribers) fn();
}

function currentAccount(): number | null {
  return useAuthStore.getState().accountId;
}

async function loadOnce(): Promise<RecentItem[]> {
  const account = currentAccount();
  if (owner === account && loading) return loading;
  owner = account;
  cache = EMPTY as RecentItem[];
  loading = (async () => {
    void del(LEGACY_KEY).catch(() => {});
    if (account == null) return cache;
    const stored = (await get<RecentItem[]>(keyFor(account))) ?? [];
    // The account changed while reading: the newer load owns the cache.
    if (owner !== account) return cache;
    cache = Array.isArray(stored) && stored.length > 0 ? stored : (EMPTY as RecentItem[]);
    return cache;
  })();
  return loading;
}

// A different account never sees the previous one's list, even in memory.
useAuthStore.subscribe((state, previous) => {
  if (state.accountId === previous.accountId) return;
  owner = undefined;
  loading = null;
  cache = EMPTY as RecentItem[];
  notify();
  if (subscribers.size) void hydrateRecentItems();
});

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
  const account = currentAccount();
  if (account == null) return;
  const current = await loadOnce();
  if (owner !== account) return;
  // A palette result and a focused-page visit can use different ids for the
  // same URL. Both represent one page in Recent.
  const next: RecentItem[] = [
    { ...item, visitedAt: Date.now() },
    ...current.filter((x) => x.id !== item.id && x.href !== item.href),
  ].slice(0, STORAGE_CAP);
  cache = next;
  notify();
  await set(keyFor(account), next);
}

export async function clearRecentItems(): Promise<void> {
  cache = EMPTY as RecentItem[];
  notify();
  const account = currentAccount();
  if (account != null) await del(keyFor(account));
}

/** Sign-out: forget the account's list on this device. */
export async function forgetRecentItems(accountId: number | null): Promise<void> {
  cache = EMPTY as RecentItem[];
  owner = undefined;
  loading = null;
  notify();
  if (accountId != null) await del(keyFor(accountId));
}
