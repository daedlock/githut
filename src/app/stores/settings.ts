import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isAnalyticsEnabled, setAnalyticsEnabledPreference } from "@/app/lib/analytics";

type SettingsState = {
  /** Enable the workspace tab bar. When off, the app uses plain router navigation. */
  tabsEnabled: boolean;
  /** Allow privacy-friendly product analytics. */
  analyticsEnabled: boolean;
  setTabsEnabled: (enabled: boolean) => void;
  setAnalyticsEnabled: (enabled: boolean) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      tabsEnabled: true,
      analyticsEnabled: isAnalyticsEnabled(),
      setTabsEnabled: (tabsEnabled) => set({ tabsEnabled }),
      setAnalyticsEnabled: (analyticsEnabled) => {
        setAnalyticsEnabledPreference(analyticsEnabled);
        set({ analyticsEnabled });
      },
    }),
    {
      name: "githut.settings",
      onRehydrateStorage: () => (state) => {
        setAnalyticsEnabledPreference(state?.analyticsEnabled ?? true);
      },
    },
  ),
);
