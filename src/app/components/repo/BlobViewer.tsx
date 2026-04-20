import { useEffect, useRef, useState } from "react";
import { codeToHtml } from "shiki";
import { Skeleton } from "@/app/components/ui/Skeleton";
import type { RepoFile } from "@/app/hooks/useRepoFile";

const EXT_TO_LANG: Record<string, string> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  py: "python",
  rb: "ruby",
  go: "go",
  rs: "rust",
  java: "java",
  kt: "kotlin",
  swift: "swift",
  c: "c",
  cpp: "cpp",
  h: "c",
  hpp: "cpp",
  cs: "csharp",
  php: "php",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  fish: "fish",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  json: "json",
  json5: "json5",
  jsonc: "jsonc",
  md: "markdown",
  mdx: "mdx",
  html: "html",
  css: "css",
  scss: "scss",
  sass: "sass",
  less: "less",
  sql: "sql",
  graphql: "graphql",
  xml: "xml",
  dockerfile: "dockerfile",
  tf: "hcl",
  hcl: "hcl",
  r: "r",
  lua: "lua",
  vim: "vim",
  nix: "nix",
  zig: "zig",
  svelte: "svelte",
  vue: "vue",
  astro: "astro",
};

function detectLang(path: string): string {
  const basename = path.split("/").pop() ?? path;
  const lower = basename.toLowerCase();

  if (lower === "dockerfile") return "dockerfile";
  if (lower === "makefile" || lower === "gnumakefile") return "makefile";
  if (lower === ".gitignore" || lower === ".gitattributes") return "gitignore";
  if (lower === ".env" || lower.startsWith(".env.")) return "shellscript";

  const ext = lower.split(".").pop() ?? "";
  return EXT_TO_LANG[ext] ?? "text";
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function BlobViewer({ file }: { file: RepoFile }) {
  const [html, setHtml] = useState<string | null>(null);
  const lang = detectLang(file.path);
  const lineCount = file.content.split("\n").length;
  const prevPath = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (prevPath.current === file.path && html !== null) return;
    prevPath.current = file.path;
    setHtml(null);

    codeToHtml(file.content, {
      lang,
      themes: { light: "github-light-default", dark: "github-dark" },
      defaultColor: false,
    }).then((result) => {
      if (!cancelled) setHtml(result);
    });

    return () => {
      cancelled = true;
    };
  }, [file.path, file.content, lang]);

  const isBinary = file.content.includes("\0");

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] overflow-hidden">
      {/* header */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-[11px] uppercase tracking-widest text-[var(--color-fg-faint)]">
            {lang}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[var(--color-fg-faint)] font-mono text-[11px] shrink-0">
          <span>{lineCount} lines</span>
          <span>{formatBytes(file.size)}</span>
        </div>
      </div>

      {/* content */}
      {isBinary ? (
        <div className="px-4 py-8 text-center font-mono text-xs text-[var(--color-fg-faint)]">
          Binary file — cannot display
        </div>
      ) : html === null ? (
        <div className="p-4 flex flex-col gap-2">
          {Array.from({ length: Math.min(lineCount, 20) }).map((_, i) => (
            <Skeleton key={i} className="h-4" style={{ width: `${60 + (i * 17) % 40}%` }} />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div
            className="text-sm font-mono leading-relaxed [&>pre]:!bg-transparent [&>pre]:p-4 [&>pre]:m-0"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: shiki output is safe, generated server-side from trusted source code
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      )}
    </div>
  );
}
