import { create } from "zustand";
import { persist } from "zustand/middleware";

// ─── Remembered tab titles ───────────────────────────────────────────────────
//
// PR and issue tabs show their title and state from the query cache, which
// lives in memory only. After the document reloads (a refresh, a dev-server
// full reload, signing in again) only the focused tab mounts, so background
// tabs would fall back to a bare "PR #12" until visited. The last title and
// state seen for each PR/issue are kept here so tabs keep their labels across
// reloads. The live cache always wins; this is only a fallback.

const MAX_ENTRIES = 200;

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
    { name: "githut.tab-titles.v1", partialize: (s) => ({ entries: s.entries }) },
  ),
);
