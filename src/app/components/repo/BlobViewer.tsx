import { CodeView } from "@/app/components/code";
import { useCodeTokens } from "@/app/components/code";
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
  tf: "hcl",
  hcl: "hcl",
  r: "r",
  lua: "lua",
  nix: "nix",
  zig: "zig",
  svelte: "svelte",
  vue: "vue",
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
  const lang = detectLang(file.path);
  const lineCount = file.content.split("\n").length;
  const isBinary = file.content.includes("\0");

  const { data: tokenLines, isPending } = useCodeTokens(
    isBinary ? "" : file.content,
    lang,
  );

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] overflow-hidden">
      {/* header */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
        <span className="font-mono text-[11px] uppercase tracking-widest text-[var(--color-fg-faint)]">
          {lang}
        </span>
        <div className="flex items-center gap-3 text-[var(--color-fg-faint)] font-mono text-[11px]">
          <span>{lineCount} lines</span>
          <span>{formatBytes(file.size)}</span>
        </div>
      </div>

      {isBinary ? (
        <div className="px-4 py-8 text-center font-mono text-xs text-[var(--color-fg-faint)]">
          Binary file — cannot display
        </div>
      ) : isPending || !tokenLines ? (
        <div className="p-4 flex flex-col gap-1.5">
          {Array.from({ length: Math.min(lineCount, 20) }).map((_, i) => (
            <Skeleton key={i} className="h-5" style={{ width: `${45 + (i * 17) % 50}%` }} />
          ))}
        </div>
      ) : (
        <CodeView lines={tokenLines} />
      )}
    </div>
  );
}
