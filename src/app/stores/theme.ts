import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

/**
 * Color palette family — the "paint" for the app. Independent of light/dark
 * (every palette defines both), so users can pair "ember" with "follow system"
 * and the right variant lands per preference.
 *
 * - stone       — canonical Githut warm-stone palette (default)
 * - ember       — warm graphite with a single coral hero (darkembertheme.com)
 * - ember-soft  — lifted-graphite ember variant, softer contrast
 */
export type Palette = "stone" | "ember" | "ember-soft" | "dune" | "haze" | "lagoon" | "lagoon-light" | "matrix" | "moss" | "sagecream";

type ThemeState = {
  palette: Palette;
  preference: ThemePreference;
  setPalette: (p: Palette) => void;
  setPreference: (p: ThemePreference) => void;
  cyclePreference: () => void;
};

const PREF_ORDER: ThemePreference[] = ["light", "dark", "system"];

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      palette: "stone",
      preference: "system",
      setPalette: (palette) => set({ palette }),
      setPreference: (preference) => set({ preference }),
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

/**
 * Map (palette, resolved light/dark) → the data-theme attribute to apply.
 *
 * The stone palette keeps the legacy `.dark` class mechanism (no attribute
 * needed); `.dark`-scoped rules in index.css handle the dark case. Ember
 * variants own their own light/dark entirely through data-theme, so .dark
 * is cleared when an Ember variant is active.
 *
 * ember-soft has no paired light — falls back to ember-light for consistency.
 */
function resolveDataTheme(palette: Palette, resolved: ResolvedTheme): string | null {
  if (palette === "stone") return null;
  if (palette === "ember") return resolved === "dark" ? "ember" : "ember-light";
  if (palette === "ember-soft") return resolved === "dark" ? "ember-soft" : "ember-light";
  // Lagoon has paired light/dark; lagoon-light has no paired dark — falls back to lagoon-light.
  if (palette === "lagoon") return resolved === "dark" ? "lagoon" : "lagoon-light";
  if (palette === "lagoon-light") return resolved === "light" ? "lagoon-light" : "lagoon";
  // Remaining doom-ported palettes are dark-only; light preference falls back to the same theme.
  if (palette === "dune") return "dune";
  if (palette === "haze") return "haze";
  if (palette === "matrix") return "matrix";
  if (palette === "moss") return "moss";
  if (palette === "sagecream") return "sagecream";
  return null;
}

function apply(palette: Palette, resolved: ResolvedTheme) {
  const root = document.documentElement;
  const dataTheme = resolveDataTheme(palette, resolved);
  if (dataTheme) {
    root.setAttribute("data-theme", dataTheme);
  } else {
    root.removeAttribute("data-theme");
  }
  root.classList.toggle("dark", resolved === "dark");
}

export function useResolvedTheme(): ResolvedTheme {
  return resolve(useThemeStore((s) => s.preference));
}

export function usePalette(): Palette {
  return useThemeStore((s) => s.palette);
}

/**
 * Wire theme state to the DOM. Call once at app bootstrap. Also subscribes to
 * (1) store changes, (2) system color-scheme changes when preference="system".
 */
export function bootstrapTheme() {
  const { palette, preference } = useThemeStore.getState();
  apply(palette, resolve(preference));

  useThemeStore.subscribe((state) => {
    apply(state.palette, resolve(state.preference));
  });

  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", () => {
    const state = useThemeStore.getState();
    if (state.preference === "system") {
      apply(state.palette, resolve("system"));
    }
  });
}
