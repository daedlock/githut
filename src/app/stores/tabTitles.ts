import { create } from "zustand";
import { persist } from "zustand/middleware";
import { accountStorage, followAccount } from "@/app/stores/accountStorage";

// ─── Remembered tab titles ───────────────────────────────────────────────────
//
// PR and issue tabs show their title and state from the query cache, which
// lives in memory only. After the document reloads (a refresh, a dev-server
// full reload, signing in again) only the focused tab mounts, so background
// tabs would fall back to a bare "PR #12" until visited. The last title and
// state seen for each PR/issue are kept here so tabs keep their labels across
// reloads. The live cache always wins; this is only a fallback. Titles of
// private PRs and issues are kept per account (see stores/accountStorage), so
// the next account on the device never sees them.

const MAX_ENTRIES = 200;
const NAME = "githut.tab-titles.v2";

// v1 was shared by every account on the device.
try {
  globalThis.localStorage?.removeItem("githut.tab-titles.v1");
} catch {
  /* Storage may be disabled. */
}

type TabTitlesState = {
  /** `owner/repo/kind/number` → `tone\0title`, oldest first. */
  entries: Record<string, string>;
  remember: (key: string, value: string) => void;
};

export const useTabTitlesStore = create<TabTitlesState>()(
  persist(
    (set, get) => ({
      entries: {},
      remember: (key, value) => {
        const { entries } = get();
        if (entries[key] === value) return;
        // Re-insert at the end so the oldest entries are evicted first.
        const { [key]: _, ...rest } = entries;
        const keys = Object.keys(rest);
        for (const old of keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES + 1))) {
          delete rest[old];
        }
        set({ entries: { ...rest, [key]: value } });
      },
    }),
    {
      name: NAME,
      storage: accountStorage<Pick<TabTitlesState, "entries">>(),
      partialize: (s) => ({ entries: s.entries }),
      merge: (persisted, current) => ({
        ...current,
        entries: (persisted as Partial<TabTitlesState> | undefined)?.entries ?? {},
      }),
    },
  ),
);

followAccount(NAME, {
  rehydrate: () => useTabTitlesStore.persist.rehydrate(),
  snapshot: () => useTabTitlesStore.getState().entries,
  adopt: (pending) =>
    useTabTitlesStore.setState({
      entries: { ...useTabTitlesStore.getState().entries, ...pending },
    }),
});
