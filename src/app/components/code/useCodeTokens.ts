import { useQuery } from "@tanstack/react-query";
import {
  bundledLanguages,
  type BundledLanguage,
  codeToTokensWithThemes,
  isSpecialLang,
} from "shiki";
import type { CodeLine } from "./types";

function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

// Shiki can only tokenize langs it actually bundles. For anything else (e.g.
// `org`, niche DSLs), feeding it the name causes a dynamic import that never
// resolves — the UI sits in a skeleton forever. Resolve at call site against
// the real bundle and drop through to plaintext when unknown.
function resolveLang(lang: string): BundledLanguage | "text" {
  if (isSpecialLang(lang)) return "text";
  return (lang in bundledLanguages ? lang : "text") as BundledLanguage | "text";
}

// Plain single-token fallback — used when Shiki rejects the input (unknown
// grammar, malformed source, etc.). Content is preserved so the viewer still
// shows something readable instead of spinning on a skeleton.
function plainTokenize(code: string): CodeLine[] {
  return code.split("\n").map((line) => (line ? [{ content: line, light: {}, dark: {} }] : []));
}

export function useCodeTokens(code: string, lang: string) {
  return useQuery({
    queryKey: ["shiki-tokens", lang, djb2(code)],
    staleTime: Infinity,
    gcTime: 10 * 60_000,
    queryFn: async (): Promise<CodeLine[]> => {
      const safeLang = resolveLang(lang);
      try {
        const lines = await codeToTokensWithThemes(code, {
          lang: safeLang,
          themes: { light: "github-light-default", dark: "github-dark" },
        });
        return lines.map((lineTokens) =>
          lineTokens.map((token) => ({
            content: token.content,
            light: {
              color: token.variants.light?.color,
              fontStyle: token.variants.light?.fontStyle,
            },
            dark: {
              color: token.variants.dark?.color,
              fontStyle: token.variants.dark?.fontStyle,
            },
          })),
        );
      } catch {
        return plainTokenize(code);
      }
    },
  });
}
