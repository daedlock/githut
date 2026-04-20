import { useQuery } from "@tanstack/react-query";
import { type BundledLanguage, codeToTokensWithThemes, isSpecialLang } from "shiki";
import type { CodeLine } from "./types";

function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

export function useCodeTokens(code: string, lang: string) {
  return useQuery({
    queryKey: ["shiki-tokens", lang, djb2(code)],
    staleTime: Infinity,
    gcTime: 10 * 60_000,
    queryFn: async (): Promise<CodeLine[]> => {
      const safeLang = (isSpecialLang(lang) ? "text" : lang) as BundledLanguage;
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
    },
  });
}
