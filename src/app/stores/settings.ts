import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import type { DiffMode } from "@/app/components/code/DiffView";
import { isAnalyticsEnabled, setAnalyticsEnabledPreference } from "@/app/lib/analytics";
import {
  type ContainerWidth,
  DEFAULT_CONTAINER_WIDTH,
  isContainerWidth,
} from "@/app/lib/containerWidth";

import {
  type CodeFont,
  type CodeFontSize,
  DEFAULT_CODE_FONT,
  DEFAULT_CODE_FONT_SIZE,
  DEFAULT_CODE_LIGATURES,
  DEFAULT_UI_FONT,
  isCodeFont,
  isCodeFontSize,
  isUiFont,
  type UiFont,
} from "@/app/lib/typography";

export type { CodeFont, CodeFontSize, UiFont } from "@/app/lib/typography";

function applyCodeFont(codeFont: CodeFont) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.codeFont = codeFont;
}

function applyUiFont(uiFont: UiFont) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.uiFont = uiFont;
}

function applyCodeFontSize(codeFontSize: CodeFontSize) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.codeFontSize = codeFontSize;
}

function applyCodeLigatures(codeLigatures: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.codeLigatures = codeLigatures ? "on" : "off";
}

function applyRepoColor(enabled: boolean) {
  if (typeof document !== "undefined")
    document.documentElement.dataset.repoColor = enabled ? "on" : "off";
}

type SettingsState = {
  /** Shared width for page content and navigation. */
  containerWidth: ContainerWidth;
  setContainerWidth: (width: ContainerWidth) => void;
  /** Show the repository identity colour cue. */
  repoColor: boolean;
  setRepoColor: (enabled: boolean) => void;
  /** Allow privacy-friendly product analytics. */
  analyticsEnabled: boolean;
  /** Preferred diff view mode (persisted across navigations). */
  diffMode: DiffMode;
  /** Typeface used by navigation, controls, and prose. */
  uiFont: UiFont;
  /** Typeface used by every monospace surface, including identifiers, source, diffs, and logs. */
  codeFont: CodeFont;
  /** Size used by dense code-reading surfaces. */
  codeFontSize: CodeFontSize;
  /** Whether programming ligatures are enabled on code-reading surfaces. */
  codeLigatures: boolean;
  setAnalyticsEnabled: (enabled: boolean) => void;
  setDiffMode: (mode: DiffMode) => void;
  setUiFont: (uiFont: UiFont) => void;
  setCodeFont: (codeFont: CodeFont) => void;
  setCodeFontSize: (codeFontSize: CodeFontSize) => void;
  setCodeLigatures: (codeLigatures: boolean) => void;
};

export const createSettingsStore = (storage?: StateStorage) =>
  create<SettingsState>()(
    persist(
      (set) => ({
        containerWidth: DEFAULT_CONTAINER_WIDTH,
        setContainerWidth: (containerWidth) => set({ containerWidth }),
        repoColor: true,
        setRepoColor: (repoColor) => {
          applyRepoColor(repoColor);
          set({ repoColor });
        },
        analyticsEnabled: isAnalyticsEnabled(),
        diffMode: "split",
        uiFont: DEFAULT_UI_FONT,
        codeFont: DEFAULT_CODE_FONT,
        codeFontSize: DEFAULT_CODE_FONT_SIZE,
        codeLigatures: DEFAULT_CODE_LIGATURES,
        setAnalyticsEnabled: (analyticsEnabled) => {
          setAnalyticsEnabledPreference(analyticsEnabled);
          set({ analyticsEnabled });
        },
        setDiffMode: (diffMode) => set({ diffMode }),
        setUiFont: (uiFont) => {
          applyUiFont(uiFont);
          set({ uiFont });
        },
        setCodeFont: (codeFont) => {
          applyCodeFont(codeFont);
          set({ codeFont });
        },
        setCodeFontSize: (codeFontSize) => {
          applyCodeFontSize(codeFontSize);
          set({ codeFontSize });
        },
        setCodeLigatures: (codeLigatures) => {
          applyCodeLigatures(codeLigatures);
          set({ codeLigatures });
        },
      }),
      {
        name: "githut.settings",
        version: 1,
        // The validated merge also drops retired settings before persisting the upgrade.
        migrate: (persisted) => persisted as SettingsState,
        storage: createJSONStorage(() => storage ?? localStorage),
        merge: (persistedState, currentState) => {
          const persisted = (persistedState ?? {}) as Partial<SettingsState>;
          return {
            ...currentState,
            repoColor: typeof persisted.repoColor === "boolean" ? persisted.repoColor : true,
            analyticsEnabled:
              typeof persisted.analyticsEnabled === "boolean"
                ? persisted.analyticsEnabled
                : currentState.analyticsEnabled,
            diffMode:
              persisted.diffMode === "unified" || persisted.diffMode === "split"
                ? persisted.diffMode
                : currentState.diffMode,
            containerWidth: isContainerWidth(persisted.containerWidth)
              ? persisted.containerWidth
              : DEFAULT_CONTAINER_WIDTH,
            uiFont: isUiFont(persisted.uiFont) ? persisted.uiFont : currentState.uiFont,
            codeFont: isCodeFont(persisted.codeFont) ? persisted.codeFont : currentState.codeFont,
            codeFontSize: isCodeFontSize(persisted.codeFontSize)
              ? persisted.codeFontSize
              : currentState.codeFontSize,
            codeLigatures:
              typeof persisted.codeLigatures === "boolean"
                ? persisted.codeLigatures
                : currentState.codeLigatures,
          };
        },
        onRehydrateStorage: () => (state) => {
          setAnalyticsEnabledPreference(state?.analyticsEnabled ?? true);
          applyUiFont(state?.uiFont ?? DEFAULT_UI_FONT);
          applyCodeFont(state?.codeFont ?? DEFAULT_CODE_FONT);
          applyCodeFontSize(state?.codeFontSize ?? DEFAULT_CODE_FONT_SIZE);
          applyCodeLigatures(state?.codeLigatures ?? DEFAULT_CODE_LIGATURES);
          applyRepoColor(state?.repoColor ?? true);
        },
      },
    ),
  );

export const useSettingsStore = createSettingsStore();
