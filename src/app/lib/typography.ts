export const UI_FONT_IDS = ["inter", "rubik", "geist", "ibm-plex-sans"] as const;
export type UiFont = (typeof UI_FONT_IDS)[number];

export const CODE_FONT_IDS = [
  "fira-code",
  "berkeley-mono",
  "jetbrains-mono",
  "ibm-plex-mono",
  "source-code-pro",
] as const;
export type CodeFont = (typeof CODE_FONT_IDS)[number];

export const CODE_FONT_SIZE_IDS = ["compact", "comfortable", "large"] as const;
export type CodeFontSize = (typeof CODE_FONT_SIZE_IDS)[number];

export const DEFAULT_UI_FONT: UiFont = "inter";
export const DEFAULT_CODE_FONT: CodeFont = "fira-code";
export const DEFAULT_CODE_FONT_SIZE: CodeFontSize = "compact";
export const DEFAULT_CODE_LIGATURES = true;

export function isUiFont(value: unknown): value is UiFont {
  return typeof value === "string" && UI_FONT_IDS.includes(value as UiFont);
}

export function isCodeFont(value: unknown): value is CodeFont {
  return typeof value === "string" && CODE_FONT_IDS.includes(value as CodeFont);
}

export function isCodeFontSize(value: unknown): value is CodeFontSize {
  return typeof value === "string" && CODE_FONT_SIZE_IDS.includes(value as CodeFontSize);
}
