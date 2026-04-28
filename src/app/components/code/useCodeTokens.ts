import { useQuery } from "@tanstack/react-query";
import { type BundledLanguage, bundledLanguages, codeToTokens, isSpecialLang } from "shiki";
import { appSyntaxTheme } from "./appTheme";
import type { CodeLineWithHtml } from "./types";
import { FS_BOLD, FS_ITALIC, FS_STRIKETHROUGH, FS_UNDERLINE } from "./types";

function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

function resolveLang(lang: string): BundledLanguage | "text" {
  if (isSpecialLang(lang)) return "text";
  return (lang in bundledLanguages ? lang : "text") as BundledLanguage | "text";
}

const ESC: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};
function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ESC[c] ?? c);
}

function tokenToHtml(content: string, color?: string, fontStyle?: number): string {
  const esc = escapeHtml(content);
  if (!color && (!fontStyle || fontStyle <= 0)) return esc;
  const parts: string[] = [];
  if (color) parts.push(`color:${color}`);
  if (fontStyle) {
    if (fontStyle & FS_ITALIC) parts.push("font-style:italic");
    if (fontStyle & FS_BOLD) parts.push("font-weight:bold");
    if (fontStyle & FS_UNDERLINE) parts.push("text-decoration:underline");
    if (fontStyle & FS_STRIKETHROUGH) parts.push("text-decoration:line-through");
  }
  return `<span style="${parts.join(";")}">${esc}</span>`;
}

function plainTokenize(code: string): CodeLineWithHtml[] {
  return code.split("\n").map((line) => ({
    tokens: line ? [{ content: line }] : [],
    html: line ? escapeHtml(line) : "",
  }));
}

export function codeTokensQueryOptions(code: string, lang: string) {
  return {
    queryKey: ["shiki-tokens", "githut-theme-v2", lang, djb2(code)],
    staleTime: Infinity,
    gcTime: 10 * 60_000,
    placeholderData: plainTokenize(code),
    queryFn: async (): Promise<CodeLineWithHtml[]> => {
      const safeLang = resolveLang(lang);
      try {
        const { tokens } = await codeToTokens(code, {
          lang: safeLang,
          theme: appSyntaxTheme,
        });
        return tokens.map((lineTokens) => {
          const toks = lineTokens.map((token) => ({
            content: token.content,
            color: token.color,
            fontStyle: token.fontStyle,
          }));
          const html = lineTokens.map((t) => tokenToHtml(t.content, t.color, t.fontStyle)).join("");
          return { tokens: toks, html };
        });
      } catch {
        return plainTokenize(code);
      }
    },
  };
}

export function useCodeTokens(code: string, lang: string) {
  return useQuery(codeTokensQueryOptions(code, lang));
}
