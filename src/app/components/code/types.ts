/** FontStyle bitmask values from @shikijs/vscode-textmate */
export const FS_ITALIC = 1;
export const FS_BOLD = 2;
export const FS_UNDERLINE = 4;
export const FS_STRIKETHROUGH = 8;

export type CodeToken = {
  content: string;
  light: { color?: string; fontStyle?: number };
  dark: { color?: string; fontStyle?: number };
};

export type CodeLine = CodeToken[];

/** Decoration applied to a single line in CodeView */
export type LineKind = "context" | "added" | "removed";

/** A single line in a unified diff */
export type DiffLine = {
  kind: LineKind;
  /** 1-indexed line number in the old file (undefined for pure additions) */
  oldNum?: number;
  /** 1-indexed line number in the new file (undefined for pure removals) */
  newNum?: number;
  content: string;
};
