import { beforeEach, describe, expect, test } from "bun:test";
import { createSettingsStore } from "@/app/stores/settings";

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
const useSettingsStore = createSettingsStore(storage);

beforeEach(() => {
  useSettingsStore.setState(useSettingsStore.getInitialState());
  values.clear();
});

describe("container width preference", () => {
  test.each(["sm", "md", "lg", "full"] as const)("saves and restores %s", async (width) => {
    useSettingsStore.getState().setContainerWidth(width);
    const saved = values.get("githut.settings")!;
    useSettingsStore.setState({ containerWidth: "md" });
    values.set("githut.settings", saved);
    await useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState().containerWidth).toBe(width);
  });

  test.each([
    undefined,
    null,
    "invalid",
    1280,
    {},
    [["full"]],
  ])("safely defaults old or invalid width %j while preserving other settings", async (containerWidth) => {
    values.set(
      "githut.settings",
      JSON.stringify({
        state: {
          containerWidth,
          tabsEnabled: false,
          codeFont: "jetbrains-mono",
          diffMode: "unified",
        },
        version: 0,
      }),
    );
    await useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState()).toMatchObject({
      containerWidth: "md",
      codeFont: "jetbrains-mono",
      diffMode: "unified",
    });
  });
});

test("repo colours default on, persist off, and retired tab preferences disappear on upgrade", async () => {
  expect(useSettingsStore.getState().repoColor).toBe(true);
  values.set(
    "githut.settings",
    JSON.stringify({ state: { tabsEnabled: false, codeFont: "jetbrains-mono" }, version: 0 }),
  );
  await useSettingsStore.persist.rehydrate();
  expect(useSettingsStore.getState().repoColor).toBe(true);
  expect(useSettingsStore.getState()).not.toHaveProperty("tabsEnabled");
  expect(JSON.parse(values.get("githut.settings")!).state).not.toHaveProperty("tabsEnabled");
  useSettingsStore.getState().setRepoColor(false);
  const restored = createSettingsStore(storage);
  expect(restored.getState().repoColor).toBe(false);
  expect(restored.getState().codeFont).toBe("jetbrains-mono");
});
