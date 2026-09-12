import { useCallback, useMemo } from "react";
import { z } from "zod";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import {
  GROUPING_FIELDS,
  type ListGrouping,
  type ListKind,
} from "@/app/features/repo/listGrouping";

const PreferenceSchema = z.object({
  groupBy: z.enum(GROUPING_FIELDS),
  collapsedGroups: z.array(z.string()),
});
type GroupingPreference = z.infer<typeof PreferenceSchema>;

const DEFAULT_PREFERENCE: GroupingPreference = { groupBy: "status", collapsedGroups: [] };

type ListGroupingState = {
  views: Record<string, GroupingPreference>;
  setGroupBy: (view: string, groupBy: ListGrouping) => void;
  setGroupsCollapsed: (view: string, keys: string[], collapsed: boolean) => void;
};

export function createListGroupingStore(storage?: StateStorage) {
  return create<ListGroupingState>()(
    persist(
      (set) => ({
        views: {},
        setGroupBy: (view, groupBy) =>
          set((state) => ({
            views: {
              ...state.views,
              [view]: { ...(state.views[view] ?? DEFAULT_PREFERENCE), groupBy },
            },
          })),
        setGroupsCollapsed: (view, keys, collapsed) =>
          set((state) => {
            const preference = state.views[view] ?? DEFAULT_PREFERENCE;
            const next = new Set(preference.collapsedGroups);
            for (const key of keys) {
              if (collapsed) next.add(key);
              else next.delete(key);
            }
            return {
              views: {
                ...state.views,
                [view]: { ...preference, collapsedGroups: [...next] },
              },
            };
          }),
      }),
      {
        name: "githut.list-grouping",
        storage: createJSONStorage(() => storage ?? localStorage),
        partialize: (state) => ({ views: state.views }),
        merge: (persisted, current) => {
          const parsed = z
            .object({ views: z.record(z.string(), PreferenceSchema) })
            .safeParse(persisted);
          return { ...current, views: parsed.success ? parsed.data.views : {} };
        },
      },
    ),
  );
}

export const useListGroupingStore = createListGroupingStore();

/** Each repository/list remembers its grouping and each property's collapsed sections. */
export function useListGrouping(owner: string, repo: string, kind: ListKind) {
  const view = `${owner}/${repo}/${kind}`.toLowerCase();
  const preference = useListGroupingStore((state) => state.views[view] ?? DEFAULT_PREFERENCE);
  const setGroupBy = useListGroupingStore((state) => state.setGroupBy);
  const setGroupsCollapsed = useListGroupingStore((state) => state.setGroupsCollapsed);

  return {
    groupBy: preference.groupBy,
    collapsedGroups: useMemo(
      () => new Set(preference.collapsedGroups),
      [preference.collapsedGroups],
    ),
    setGroupBy: useCallback((value: ListGrouping) => setGroupBy(view, value), [setGroupBy, view]),
    setGroupsCollapsed: useCallback(
      (keys: string[], collapsed: boolean) => setGroupsCollapsed(view, keys, collapsed),
      [setGroupsCollapsed, view],
    ),
  };
}
