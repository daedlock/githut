export type ThemeMode = "light" | "dark";

export type Palette =
  | "main"
  | "stone"
  | "ember"
  | "ember-soft"
  | "dune"
  | "haze"
  | "lagoon"
  | "lagoon-light"
  | "matrix"
  | "moss"
  | "sagecream"
  | "catppuccin"
  | "solarized";

export type ThemeOption = {
  id: string;
  name: string;
  label: string;
  mode: ThemeMode;
  palette: Palette;
  preference: ThemeMode;
  swatches: readonly [string, string, string];
  keywords: readonly string[];
};

export const THEME_OPTIONS: readonly ThemeOption[] = [
  {
    id: "main-light",
    name: "GitHut Light",
    label: "GitHut",
    mode: "light",
    palette: "main",
    preference: "light",
    swatches: ["#f8f8f8", "#1a1a1a", "#2e7dd6"],
    keywords: ["default", "neutral", "blue", "daylight"],
  },
  {
    id: "main-dark",
    name: "GitHut Dark",
    label: "GitHut",
    mode: "dark",
    palette: "main",
    preference: "dark",
    swatches: ["#1c1d24", "#dfe1e8", "#68adf7"],
    keywords: ["default", "neutral", "blue", "night"],
  },
  {
    id: "stone-light",
    name: "Stone Light",
    label: "Stone",
    mode: "light",
    palette: "stone",
    preference: "light",
    swatches: ["#fafaf9", "#1c1917", "#c2410c"],
    keywords: ["warm", "daylight"],
  },
  {
    id: "stone-dark",
    name: "Stone Dark",
    label: "Stone",
    mode: "dark",
    palette: "stone",
    preference: "dark",
    swatches: ["#0c0a09", "#fafaf9", "#fb923c"],
    keywords: ["warm", "night"],
  },
  {
    id: "ember-light",
    name: "Ember Light",
    label: "Ember",
    mode: "light",
    palette: "ember",
    preference: "light",
    swatches: ["#e6dac4", "#282418", "#993d24"],
    keywords: ["parchment", "ivory", "coral"],
  },
  {
    id: "ember-soft",
    name: "Ember Soft",
    label: "Ember Soft",
    mode: "dark",
    palette: "ember-soft",
    preference: "dark",
    swatches: ["#242320", "#d8d0c0", "#e08060"],
    keywords: ["coral", "soft", "lifted"],
  },
  {
    id: "ember",
    name: "Ember Dark",
    label: "Ember",
    mode: "dark",
    palette: "ember",
    preference: "dark",
    swatches: ["#1c1b19", "#d8d0c0", "#e08060"],
    keywords: ["coral", "graphite", "spark"],
  },
  {
    id: "dune",
    name: "Dune",
    label: "Dune",
    mode: "dark",
    palette: "dune",
    preference: "dark",
    swatches: ["#171b1e", "#d0c8b8", "#b89068"],
    keywords: ["amber", "charcoal", "earth"],
  },
  {
    id: "haze",
    name: "Haze",
    label: "Haze",
    mode: "dark",
    palette: "haze",
    preference: "dark",
    swatches: ["#2a292e", "#d5d0d8", "#d0a0c8"],
    keywords: ["lavender", "mauve", "purple"],
  },
  {
    id: "lagoon-light",
    name: "Lagoon Light",
    label: "Lagoon",
    mode: "light",
    palette: "lagoon",
    preference: "light",
    swatches: ["#d8eae6", "#2d2818", "#993828"],
    keywords: ["seafoam", "coral", "paper", "light"],
  },
  {
    id: "lagoon",
    name: "Lagoon Dark",
    label: "Lagoon",
    mode: "dark",
    palette: "lagoon",
    preference: "dark",
    swatches: ["#101a18", "#c8c4b0", "#e07060"],
    keywords: ["coral", "teal", "reef"],
  },
  {
    id: "matrix",
    name: "Matrix",
    label: "Matrix",
    mode: "dark",
    palette: "matrix",
    preference: "dark",
    swatches: ["#0c120f", "#ddeee3", "#4dcb8c"],
    keywords: ["green", "phosphor", "hacker"],
  },
  {
    id: "moss",
    name: "Moss",
    label: "Moss",
    mode: "dark",
    palette: "moss",
    preference: "dark",
    swatches: ["#1e2421", "#d4ccb3", "#8db16d"],
    keywords: ["forest", "earthy", "green"],
  },
  {
    id: "sagecream",
    name: "Sagecream",
    label: "Sagecream",
    mode: "dark",
    palette: "sagecream",
    preference: "dark",
    swatches: ["#1a1918", "#d0cdb8", "#90a878"],
    keywords: ["sage", "cream", "neutral"],
  },
  {
    id: "catppuccin-light",
    name: "Catppuccin Latte",
    label: "Catppuccin",
    mode: "light",
    palette: "catppuccin",
    preference: "light",
    swatches: ["#eff1f5", "#4c4f69", "#1c60e8"],
    keywords: ["latte", "pastel", "popular", "lavender"],
  },
  {
    id: "catppuccin-dark",
    name: "Catppuccin Mocha",
    label: "Catppuccin",
    mode: "dark",
    palette: "catppuccin",
    preference: "dark",
    swatches: ["#1e1e2e", "#cdd6f4", "#89b4fa"],
    keywords: ["mocha", "pastel", "popular", "lavender"],
  },
  {
    id: "solarized-light",
    name: "Solarized Light",
    label: "Solarized",
    mode: "light",
    palette: "solarized",
    preference: "light",
    swatches: ["#fdf6e3", "#002b36", "#176f9f"],
    keywords: ["classic", "paper", "blue", "popular"],
  },
  {
    id: "solarized-dark",
    name: "Solarized Dark",
    label: "Solarized",
    mode: "dark",
    palette: "solarized",
    preference: "dark",
    swatches: ["#002b36", "#eee8d5", "#3aa6d8"],
    keywords: ["classic", "terminal", "blue", "popular"],
  },
];

export const PALETTE_FAMILIES: readonly { id: Palette; name: string }[] = [
  { id: "main", name: "githut" },
  { id: "stone", name: "stone" },
  { id: "ember", name: "ember" },
  { id: "ember-soft", name: "ember-soft" },
  { id: "dune", name: "dune" },
  { id: "haze", name: "haze" },
  { id: "lagoon", name: "lagoon" },
  { id: "matrix", name: "matrix" },
  { id: "moss", name: "moss" },
  { id: "sagecream", name: "sagecream" },
  { id: "catppuccin", name: "catppuccin" },
  { id: "solarized", name: "solarized" },
];

export function resolvePaletteDataTheme(palette: Palette, mode: ThemeMode): string | null {
  if (palette === "main") return mode === "dark" ? "main-dark" : "main-light";
  if (palette === "stone") return null;
  if (palette === "ember") return mode === "dark" ? "ember" : "ember-light";
  if (palette === "ember-soft") return mode === "dark" ? "ember-soft" : "ember-light";
  if (palette === "lagoon") return mode === "dark" ? "lagoon" : "lagoon-light";
  if (palette === "lagoon-light") return mode === "light" ? "lagoon-light" : "lagoon";
  if (palette === "catppuccin") {
    return mode === "dark" ? "catppuccin-dark" : "catppuccin-light";
  }
  if (palette === "solarized") return mode === "dark" ? "solarized-dark" : "solarized-light";
  if (palette === "dune") return "dune";
  if (palette === "haze") return "haze";
  if (palette === "matrix") return "matrix";
  if (palette === "moss") return "moss";
  if (palette === "sagecream") return "sagecream";
  return null;
}
