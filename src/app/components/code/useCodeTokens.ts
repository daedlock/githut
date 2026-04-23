import { useQuery } from "@tanstack/react-query";
import { bundledLanguages, type BundledLanguage, codeToTokens, isSpecialLang } from "shiki";
import { appSyntaxTheme } from "./appTheme";
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
  return code.split("\n").map((line) => (line ? [{ content: line }] : []));
}

export function codeTokensQueryOptions(code: string, lang: string) {
  return {
    queryKey: ["shiki-tokens", "githut-theme-v2", lang, djb2(code)],
    staleTime: Infinity,
    gcTime: 10 * 60_000,
    queryFn: async (): Promise<CodeLine[]> => {
      const safeLang = resolveLang(lang);
      try {
        const { tokens } = await codeToTokens(code, {
          lang: safeLang,
          // Custom theme emits `var(--syntax-*)` color strings. The browser
          // resolves them against whichever palette is active on <html>, so
          // light/dark swaps happen without re-tokenizing.
          theme: appSyntaxTheme,
        });
        return tokens.map((lineTokens) =>
          lineTokens.map((token) => ({
            content: token.content,
            color: token.color,
            fontStyle: token.fontStyle,
          })),
        );
      } catch {
        return plainTokenize(code);
      }
    },
  };
}

export function useCodeTokens(code: string, lang: string) {
  return useQuery(codeTokensQueryOptions(code, lang));
}
