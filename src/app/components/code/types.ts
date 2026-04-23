/** FontStyle bitmask values from @shikijs/vscode-textmate */
export const FS_ITALIC = 1;
export const FS_BOLD = 2;
export const FS_UNDERLINE = 4;
export const FS_STRIKETHROUGH = 8;

/**
 * A single Shiki-tokenized run of characters. Shape is intentionally
 * single-theme: our custom theme emits CSS-variable references as color
 * strings (var(--syntax-*)), so the browser handles the light/dark swap at
 * paint time. That removes the prior --tl/--td inline dance.
 */
export type CodeToken = {
  content: string;
  /** CSS color string — typically `var(--syntax-*)` from the app theme. */
  color?: string;
  /** Shiki fontStyle bitmask — italic/bold/underline/strikethrough. */
  fontStyle?: number;
};

export type CodeLine = CodeToken[];

export type CodeLineWithHtml = {
  tokens: CodeToken[];
  html: string;
};

/** Decoration applied to a single line in CodeView. Distinct from parseDiff's
 *  DiffLineKind ("add"/"del") — CodeView is older and uses the verbose forms. */
export type LineKind = "context" | "added" | "removed";
