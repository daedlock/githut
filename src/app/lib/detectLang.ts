/**
 * detectLang — map a file path to a Shiki grammar name. Unknown extensions
 * fall through to "text" so `useCodeTokens` can render them without throwing.
 *
 * Kept deliberately narrow: only extensions we actually render. Add here when
 * a new viewer surface (code tab, diff, commit detail) needs a new language.
 */

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
  org: "org",
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

export function detectLang(path: string): string {
  const basename = path.split("/").pop() ?? path;
  const lower = basename.toLowerCase();
  if (lower === "dockerfile") return "dockerfile";
  if (lower === "makefile" || lower === "gnumakefile") return "makefile";
  if (lower === ".gitignore" || lower === ".gitattributes") return "gitignore";
  if (lower === ".env" || lower.startsWith(".env.")) return "shellscript";
  const ext = lower.split(".").pop() ?? "";
  return EXT_TO_LANG[ext] ?? "text";
}
