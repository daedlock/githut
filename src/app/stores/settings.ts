import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isAnalyticsEnabled, setAnalyticsEnabledPreference } from "@/app/lib/analytics";
import type { DiffMode } from "@/app/components/code/DiffView";

type SettingsState = {
  /** Enable the workspace tab bar. When off, the app uses plain router navigation. */
  tabsEnabled: boolean;
  /** Allow privacy-friendly product analytics. */
  analyticsEnabled: boolean;
  /** Preferred diff view mode (persisted across navigations). */
  diffMode: DiffMode;
  setTabsEnabled: (enabled: boolean) => void;
  setAnalyticsEnabled: (enabled: boolean) => void;
  setDiffMode: (mode: DiffMode) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      tabsEnabled: true,
      analyticsEnabled: isAnalyticsEnabled(),
      diffMode: "split",
      setTabsEnabled: (tabsEnabled) => set({ tabsEnabled }),
      setAnalyticsEnabled: (analyticsEnabled) => {
        setAnalyticsEnabledPreference(analyticsEnabled);
        set({ analyticsEnabled });
      },
      setDiffMode: (diffMode) => set({ diffMode }),
    }),
    {
      name: "githut.settings",
      onRehydrateStorage: () => (state) => {
        setAnalyticsEnabledPreference(state?.analyticsEnabled ?? true);
      },
    },
  ),
);
