import { create } from "zustand";
import { persist } from "zustand/middleware";

type ThemePreference = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

type ThemeState = {
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => void;
  cyclePreference: () => void;
};

const PREF_ORDER: ThemePreference[] = ["light", "dark", "system"];

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      preference: "system",
      setPreference: (pref) => set({ preference: pref }),
      cyclePreference: () => {
        const current = get().preference;
        const next = PREF_ORDER[(PREF_ORDER.indexOf(current) + 1) % PREF_ORDER.length]!;
        set({ preference: next });
      },
    }),
    { name: "githut.theme" },
  ),
);

function systemPrefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolve(pref: ThemePreference): ResolvedTheme {
  if (pref === "system") return systemPrefersDark() ? "dark" : "light";
  return pref;
}

function apply(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
}

export function useResolvedTheme(): ResolvedTheme {
  return resolve(useThemeStore((s) => s.preference));
}

export function bootstrapTheme() {
  const { preference } = useThemeStore.getState();
  apply(resolve(preference));

  useThemeStore.subscribe((state) => {
    apply(resolve(state.preference));
  });

  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", () => {
    if (useThemeStore.getState().preference === "system") {
      apply(resolve("system"));
    }
  });
}
