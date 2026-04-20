import type { ThemeRegistrationRaw } from "shiki";

/**
 * Our app's Shiki theme.
 *
 * Shiki does NOT accept arbitrary strings (e.g. `var(--syntax-keyword)`) in
 * tokenColors — it validates foreground values and silently drops anything
 * that isn't a hex/rgb color, leaving tokens uncolored. The officially
 * supported path for CSS-variable theming is:
 *
 *   1. Use distinct hex PLACEHOLDER colors per syntax role in the theme.
 *   2. Provide `colorReplacements` mapping each placeholder to its CSS var.
 *   3. Shiki tokenizes with hex, then rewrites the output colors to the vars.
 *
 * This gives us the end result we wanted (token.color === "var(--syntax-*)")
 * without tripping Shiki's color parsing. The placeholder hexes never appear
 * in the rendered HTML.
 */

// Distinct fake hexes — role-keyed so replacements are readable, not magical.
// The exact values don't matter; they only need to be unique.
const P = {
  default: "#ff00f0",
  comment: "#ff00f1",
  keyword: "#ff00f2",
  string: "#ff00f3",
  number: "#ff00f4",
  function: "#ff00f5",
  type: "#ff00f6",
  property: "#ff00f7",
  constant: "#ff00f8",
  variable: "#ff00f9",
  operator: "#ff00fa",
  punctuation: "#ff00fb",
  tag: "#ff00fc",
  attribute: "#ff00fd",
  meta: "#ff00fe",
  regex: "#ff00ff",
} as const;

const colorReplacements: Record<string, string> = {
  [P.default]: "var(--color-fg)",
  [P.comment]: "var(--syntax-comment)",
  [P.keyword]: "var(--syntax-keyword)",
  [P.string]: "var(--syntax-string)",
  [P.number]: "var(--syntax-number)",
  [P.function]: "var(--syntax-function)",
  [P.type]: "var(--syntax-type)",
  [P.property]: "var(--syntax-property)",
  [P.constant]: "var(--syntax-constant)",
  [P.variable]: "var(--syntax-variable)",
  [P.operator]: "var(--syntax-operator)",
  [P.punctuation]: "var(--syntax-punctuation)",
  [P.tag]: "var(--syntax-tag)",
  [P.attribute]: "var(--syntax-attribute)",
  [P.meta]: "var(--syntax-meta)",
  [P.regex]: "var(--syntax-regex)",
};

export const appSyntaxTheme: ThemeRegistrationRaw = {
  name: "githut",
  type: "dark",
  // `colorReplacements` on the theme object is Shiki's supported hook for
  // post-tokenize color remapping. Keeps everything self-contained.
  colorReplacements,
  colors: {
    "editor.background": "#000000",
    "editor.foreground": P.default,
  },
  // All scope rules live here. Shiki uses the TextMate-style `settings` array
  // when present and IGNORES a sibling `tokenColors` field — putting the
  // scoped rules anywhere else silently strips all syntax highlighting.
  // First entry (no `scope`) is the default foreground/background.
  settings: [
    {
      settings: {
        background: "#000000",
        foreground: P.default,
      },
    },

    // Comments first — they win over anything else that might match
    {
      scope: ["comment", "punctuation.definition.comment", "string.comment"],
      settings: { foreground: P.comment, fontStyle: "italic" },
    },

    // Imports / exports / directives — before generic keyword
    {
      scope: [
        "keyword.control.import",
        "keyword.control.from",
        "keyword.control.export",
        "keyword.other.import",
        "meta.preprocessor",
        "meta.import",
      ],
      settings: { foreground: P.meta },
    },

    // Regular keywords: if/else/return/class/function/const/let/var, storage
    {
      scope: [
        "keyword",
        "keyword.control",
        "keyword.operator.new",
        "keyword.operator.expression",
        "storage",
        "storage.type",
        "storage.modifier",
      ],
      settings: { foreground: P.keyword },
    },

    // Strings (and string escape sequences)
    {
      scope: [
        "string",
        "string.quoted",
        "string.template",
        "punctuation.definition.string",
        "meta.string",
      ],
      settings: { foreground: P.string },
    },
    {
      scope: ["constant.character.escape", "string .constant.character"],
      settings: { foreground: P.keyword },
    },

    // Regex — before number (numeric literals inside regex were confusing)
    {
      scope: ["string.regexp"],
      settings: { foreground: P.regex },
    },

    // Numbers + language constants (true/false/null/undefined)
    {
      scope: ["constant.numeric", "constant.language", "constant.language.boolean"],
      settings: { foreground: P.number },
    },

    // Named constants (UPPER_CASE idents)
    {
      scope: ["variable.other.constant", "constant.other"],
      settings: { foreground: P.constant },
    },

    // Functions — callable identifiers
    {
      scope: [
        "entity.name.function",
        "support.function",
        "meta.function-call.generic",
        "variable.function",
      ],
      settings: { foreground: P.function },
    },

    // Types / classes / interfaces
    {
      scope: [
        "entity.name.type",
        "entity.name.class",
        "entity.name.interface",
        "entity.name.namespace",
        "support.type",
        "support.class",
        "meta.type.declaration",
      ],
      settings: { foreground: P.type },
    },

    // Object properties / member access
    {
      scope: [
        "variable.other.property",
        "variable.other.object.property",
        "meta.property-name",
        "support.variable.property",
      ],
      settings: { foreground: P.property },
    },

    // HTML/JSX tags
    {
      scope: ["entity.name.tag", "support.class.component"],
      settings: { foreground: P.tag },
    },

    // HTML/JSX attribute names
    {
      scope: ["entity.other.attribute-name"],
      settings: { foreground: P.attribute },
    },

    // Operators + punctuation — muted so structure recedes
    {
      scope: ["keyword.operator", "punctuation.separator", "punctuation.accessor"],
      settings: { foreground: P.operator },
    },
    {
      scope: ["punctuation"],
      settings: { foreground: P.punctuation },
    },

    // Generic variables / identifiers — default fg
    {
      scope: ["variable", "variable.other"],
      settings: { foreground: P.variable },
    },
  ],
};
