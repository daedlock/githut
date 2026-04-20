import { create } from "zustand";
import { persist } from "zustand/middleware";

type SettingsState = {
  /** Enable the workspace tab bar. When off, the app uses plain router navigation. */
  tabsEnabled: boolean;
  setTabsEnabled: (enabled: boolean) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      tabsEnabled: true,
      setTabsEnabled: (tabsEnabled) => set({ tabsEnabled }),
    }),
    { name: "githut.settings" },
  ),
);
