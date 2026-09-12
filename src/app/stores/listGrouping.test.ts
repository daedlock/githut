import { beforeEach, describe, expect, test } from "bun:test";
import { createListGroupingStore } from "@/app/stores/listGrouping";

const values = new Map<string, string>();
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => {
    values.set(key, value);
  },
  removeItem: (key: string) => {
    values.delete(key);
  },
};
const useListGroupingStore = createListGroupingStore(storage);

beforeEach(() => {
  values.clear();
  useListGroupingStore.setState({ views: {} });
});

describe("grouping preferences", () => {
  test("keeps repositories and issue/PR views independent", () => {
    const store = useListGroupingStore.getState();
    store.setGroupBy("acme/console/pulls", "assignee");
    store.setGroupBy("acme/console/issues", "label");
    store.setGroupBy("acme/api/pulls", "milestone");
    const { views } = useListGroupingStore.getState();
    expect(views["acme/console/pulls"]?.groupBy).toBe("assignee");
    expect(views["acme/console/issues"]?.groupBy).toBe("label");
    expect(views["acme/api/pulls"]?.groupBy).toBe("milestone");
  });

  test("remembers collapsed groups when switching grouping and expanding filtered results", () => {
    const store = useListGroupingStore.getState();
    const view = "acme/console/pulls";
    store.setGroupBy(view, "label");
    store.setGroupsCollapsed(view, ["label:name:bug", "label:none"], true);
    store.setGroupBy(view, "assignee");
    store.setGroupsCollapsed(view, ["assignee:none"], true);
    store.setGroupBy(view, "label");
    store.setGroupsCollapsed(view, ["label:name:bug"], false);
    expect(useListGroupingStore.getState().views[view]?.collapsedGroups).toEqual([
      "label:none",
      "assignee:none",
    ]);
    store.setGroupsCollapsed(view, ["label:none"], true);
    expect(useListGroupingStore.getState().views[view]?.collapsedGroups.length).toBe(2);
  });

  test("restores grouping and collapsed sections after reload", async () => {
    const store = useListGroupingStore.getState();
    const view = "acme/console/issues";
    store.setGroupBy(view, "author");
    store.setGroupsCollapsed(view, ["author:user:alice"], true);
    const saved = storage.getItem("githut.list-grouping")!;
    useListGroupingStore.setState({ views: {} });
    storage.setItem("githut.list-grouping", saved);
    await useListGroupingStore.persist.rehydrate();
    expect(useListGroupingStore.getState().views[view]).toEqual({
      groupBy: "author",
      collapsedGroups: ["author:user:alice"],
    });
  });

  test("ignores invalid saved preferences instead of breaking the list", async () => {
    storage.setItem(
      "githut.list-grouping",
      JSON.stringify({
        state: { views: { "acme/console/pulls": { groupBy: "unknown", collapsedGroups: null } } },
        version: 0,
      }),
    );
    await useListGroupingStore.persist.rehydrate();
    expect(useListGroupingStore.getState().views).toEqual({});
    useListGroupingStore.getState().setGroupBy("acme/console/pulls", "none");
    expect(useListGroupingStore.getState().views["acme/console/pulls"]?.groupBy).toBe("none");
  });
});
