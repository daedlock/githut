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

/** Decoration applied to a single line in CodeView. Distinct from parseDiff's
 *  DiffLineKind ("add"/"del") — CodeView is older and uses the verbose forms. */
export type LineKind = "context" | "added" | "removed";
