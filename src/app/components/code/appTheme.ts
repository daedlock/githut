import type { ThemeRegistrationRaw } from "shiki";

/**
 * Our app's Shiki theme. Every foreground color is a CSS variable reference
 * (`var(--syntax-*)`), which Shiki passes through as-is into token inline
 * styles. The browser resolves them at paint time, so syntax colors
 * participate in whatever `.dark` / theme preset is active on <html>.
 *
 * This is the "last mile" of app theming — everything upstream (surfaces,
 * borders, diff tints) was already token-driven; syntax highlighting used to
 * be stuck on GitHub's baked colors until now.
 *
 * Keep the scope list deliberately short. TextMate grammars emit noisy,
 * grammar-specific scopes; Shiki walks the list top-to-bottom and picks the
 * first match, so specific rules (e.g. "keyword.control.import") should come
 * BEFORE their parent ("keyword"). Every rule added here should map to an
 * existing --syntax-* token, not introduce a new color.
 */
export const appSyntaxTheme: ThemeRegistrationRaw = {
  name: "githut",
  type: "light",
  // Minimal global `settings` entry — some Shiki code paths require this
  // (e.g. background/foreground fallback for tokens with no scope match).
  settings: [
    {
      settings: {
        background: "var(--color-bg)",
        foreground: "var(--color-fg)",
      },
    },
  ],
  colors: {
    "editor.background": "var(--color-bg)",
    "editor.foreground": "var(--color-fg)",
  },
  tokenColors: [
    // Comments first — they win over anything else that might match
    {
      scope: ["comment", "punctuation.definition.comment", "string.comment"],
      settings: { foreground: "var(--syntax-comment)", fontStyle: "italic" },
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
      settings: { foreground: "var(--syntax-meta)" },
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
      settings: { foreground: "var(--syntax-keyword)" },
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
      settings: { foreground: "var(--syntax-string)" },
    },
    {
      scope: ["constant.character.escape", "string .constant.character"],
      settings: { foreground: "var(--syntax-keyword)" },
    },

    // Regex — before number (numeric literals inside regex were confusing)
    {
      scope: ["string.regexp"],
      settings: { foreground: "var(--syntax-regex)" },
    },

    // Numbers + language constants (true/false/null/undefined)
    {
      scope: ["constant.numeric", "constant.language", "constant.language.boolean"],
      settings: { foreground: "var(--syntax-number)" },
    },

    // Named constants (UPPER_CASE idents)
    {
      scope: ["variable.other.constant", "constant.other"],
      settings: { foreground: "var(--syntax-constant)" },
    },

    // Functions — callable identifiers
    {
      scope: [
        "entity.name.function",
        "support.function",
        "meta.function-call.generic",
        "variable.function",
      ],
      settings: { foreground: "var(--syntax-function)" },
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
      settings: { foreground: "var(--syntax-type)" },
    },

    // Object properties / member access
    {
      scope: [
        "variable.other.property",
        "variable.other.object.property",
        "meta.property-name",
        "support.variable.property",
      ],
      settings: { foreground: "var(--syntax-property)" },
    },

    // HTML/JSX tags
    {
      scope: ["entity.name.tag", "support.class.component"],
      settings: { foreground: "var(--syntax-tag)" },
    },

    // HTML/JSX attribute names
    {
      scope: ["entity.other.attribute-name"],
      settings: { foreground: "var(--syntax-attribute)" },
    },

    // Operators + punctuation — muted so structure recedes
    {
      scope: ["keyword.operator", "punctuation.separator", "punctuation.accessor"],
      settings: { foreground: "var(--syntax-operator)" },
    },
    {
      scope: ["punctuation"],
      settings: { foreground: "var(--syntax-punctuation)" },
    },

    // Generic variables / identifiers — default fg
    {
      scope: ["variable", "variable.other"],
      settings: { foreground: "var(--syntax-variable)" },
    },
  ],
};
