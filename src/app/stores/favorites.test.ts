import { expect, test } from "bun:test";
import { createFavoritesStore } from "./favorites";

test("repository and view favorites persist independently and stay isolated by verified account", () => {
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
  const store = createFavoritesStore(storage);
  store.getState().add(12, { kind: "repo", href: "/demo/project/code" });
  store.getState().add(12, { kind: "view", href: "/demo/project/pulls?state=closed" });
  store.getState().add(12, { kind: "repo", href: "/demo/project/code" });
  expect(store.getState().forAccount(12)).toHaveLength(2);
  expect(store.getState().forAccount(13)).toEqual([]);
  expect(store.getState().forAccount(null)).toEqual([]);
  const restored = createFavoritesStore(storage);
  expect(
    restored
      .getState()
      .forAccount(12)
      .map((item) => item.href),
  ).toEqual(["/demo/project/code", "/demo/project/pulls?state=closed"]);
  restored.getState().remove(12, restored.getState().forAccount(12)[0]!.id);
  expect(restored.getState().forAccount(12)).toHaveLength(1);
  restored.getState().add(null, { kind: "view", href: "/" });
  expect(restored.getState().forAccount(null)).toEqual([]);
});
