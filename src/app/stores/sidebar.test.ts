import { expect, test } from "bun:test";
import { createSidebarStore } from "@/app/stores/sidebar";

test("sidebar resize snaps to the rail, restores the last width and persists on this device", () => {
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
  const store = createSidebarStore(storage);
  store.getState().resize(300);
  store.getState().resize(100);
  expect(store.getState().collapsed).toBe(true);
  store.getState().toggle();
  expect(store.getState().width).toBe(300);
  const restored = createSidebarStore(storage);
  expect(restored.getState().width).toBe(300);
  expect(restored.getState().collapsed).toBe(false);
  restored.getState().resize(500);
  expect(restored.getState().width).toBe(360);
  restored.getState().resize(180);
  expect(restored.getState().width).toBe(200);
  restored.getState().reset();
  expect(restored.getState().width).toBe(240);
});
