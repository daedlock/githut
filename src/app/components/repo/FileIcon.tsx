import {
  Box,
  Braces,
  Dot,
  File as FileIconBase,
  FileArchive,
  FileCode,
  FileCog,
  FileImage,
  FileJson,
  FileLock,
  FileText,
  FileType,
  GitBranch,
  Hammer,
  Lock,
  Palette,
  ScrollText,
  Terminal,
} from "lucide-react";
import type { SVGProps } from "react";
import { cn } from "@/app/lib/cn";

/**
 * File icon system — one icon + one color per file, derived from the path.
 *
 * The goal is VSCode/Material-Icon-Theme-esque visual rhythm in sidebars
 * without shipping thousands of SVGs. Uses lucide shapes for categories
 * (code/data/image/config/...) and --icon-* language tokens for color so
 * TypeScript is blue, Python is blue-teal, Rust is orange-red, etc.,
 * consistently across every surface in the app.
 */

type LucideLike = React.ComponentType<SVGProps<SVGSVGElement> & { className?: string }>;

type IconSpec = {
  icon: LucideLike;
  color: string; // CSS var reference, e.g. "var(--icon-ts)"
};

const DEFAULT_SPEC: IconSpec = { icon: FileIconBase, color: "var(--icon-default)" };

// Exact-filename matches take precedence over extension lookups. Covers the
// files that have more meaning than their extension alone (a package.json is
// not just "any json", and a Dockerfile isn't an extension-based match).
const NAMED_MAP: Record<string, IconSpec> = {
  dockerfile: { icon: Box, color: "var(--icon-docker)" },
  ".dockerignore": { icon: Box, color: "var(--icon-docker)" },
  "docker-compose.yml": { icon: Box, color: "var(--icon-docker)" },
  "docker-compose.yaml": { icon: Box, color: "var(--icon-docker)" },

  makefile: { icon: Hammer, color: "var(--icon-default)" },
  gnumakefile: { icon: Hammer, color: "var(--icon-default)" },

  "package.json": { icon: Box, color: "var(--icon-js)" },
  "package-lock.json": { icon: FileLock, color: "var(--icon-default)" },
  "bun.lockb": { icon: FileLock, color: "var(--icon-default)" },
  "bun.lock": { icon: FileLock, color: "var(--icon-default)" },
  "yarn.lock": { icon: FileLock, color: "var(--icon-default)" },
  "pnpm-lock.yaml": { icon: FileLock, color: "var(--icon-default)" },

  "cargo.toml": { icon: Box, color: "var(--icon-rust)" },
  "cargo.lock": { icon: FileLock, color: "var(--icon-rust)" },

  "tsconfig.json": { icon: FileCog, color: "var(--icon-ts)" },
  "tsconfig.build.json": { icon: FileCog, color: "var(--icon-ts)" },
  "jsconfig.json": { icon: FileCog, color: "var(--icon-js)" },
  "vite.config.ts": { icon: FileCog, color: "var(--icon-ts)" },
  "vite.config.js": { icon: FileCog, color: "var(--icon-js)" },
  "webpack.config.js": { icon: FileCog, color: "var(--icon-js)" },
  "rollup.config.js": { icon: FileCog, color: "var(--icon-js)" },
  "biome.json": { icon: FileCog, color: "var(--icon-js)" },
  ".eslintrc": { icon: FileCog, color: "var(--icon-js)" },
  ".eslintrc.json": { icon: FileCog, color: "var(--icon-js)" },
  ".prettierrc": { icon: FileCog, color: "var(--icon-js)" },
  "tailwind.config.js": { icon: Palette, color: "var(--icon-style)" },
  "tailwind.config.ts": { icon: Palette, color: "var(--icon-style)" },
  "postcss.config.js": { icon: FileCog, color: "var(--icon-style)" },

  ".gitignore": { icon: GitBranch, color: "var(--icon-default)" },
  ".gitattributes": { icon: GitBranch, color: "var(--icon-default)" },
  ".gitmodules": { icon: GitBranch, color: "var(--icon-default)" },

  ".env": { icon: Lock, color: "var(--icon-default)" },
  ".env.local": { icon: Lock, color: "var(--icon-default)" },
  ".env.production": { icon: Lock, color: "var(--icon-default)" },
  ".env.development": { icon: Lock, color: "var(--icon-default)" },

  "readme.md": { icon: ScrollText, color: "var(--icon-default)" },
  "readme.org": { icon: ScrollText, color: "var(--icon-default)" },
  "changelog.md": { icon: ScrollText, color: "var(--icon-default)" },
  "license": { icon: ScrollText, color: "var(--icon-default)" },
  "license.md": { icon: ScrollText, color: "var(--icon-default)" },
  "license.txt": { icon: ScrollText, color: "var(--icon-default)" },
};

const EXT_MAP: Record<string, IconSpec> = {
  // TS / JS family
  ts: { icon: FileCode, color: "var(--icon-ts)" },
  tsx: { icon: FileCode, color: "var(--icon-ts)" },
  mts: { icon: FileCode, color: "var(--icon-ts)" },
  cts: { icon: FileCode, color: "var(--icon-ts)" },
  "d.ts": { icon: FileCode, color: "var(--icon-ts)" },
  js: { icon: FileCode, color: "var(--icon-js)" },
  jsx: { icon: FileCode, color: "var(--icon-js)" },
  mjs: { icon: FileCode, color: "var(--icon-js)" },
  cjs: { icon: FileCode, color: "var(--icon-js)" },

  // Other languages
  py: { icon: FileCode, color: "var(--icon-python)" },
  pyi: { icon: FileCode, color: "var(--icon-python)" },
  rs: { icon: FileCode, color: "var(--icon-rust)" },
  go: { icon: FileCode, color: "var(--icon-go)" },
  rb: { icon: FileCode, color: "var(--icon-ruby)" },
  java: { icon: FileCode, color: "var(--icon-markup)" },
  kt: { icon: FileCode, color: "var(--icon-markup)" },
  swift: { icon: FileCode, color: "var(--icon-markup)" },
  c: { icon: FileCode, color: "var(--icon-ts)" },
  cpp: { icon: FileCode, color: "var(--icon-ts)" },
  h: { icon: FileCode, color: "var(--icon-ts)" },
  hpp: { icon: FileCode, color: "var(--icon-ts)" },
  cs: { icon: FileCode, color: "var(--icon-style)" },
  php: { icon: FileCode, color: "var(--icon-style)" },
  lua: { icon: FileCode, color: "var(--icon-python)" },
  zig: { icon: FileCode, color: "var(--icon-rust)" },
  nix: { icon: FileCode, color: "var(--icon-default)" },
  r: { icon: FileCode, color: "var(--icon-python)" },

  // Shell / scripts
  sh: { icon: Terminal, color: "var(--icon-shell)" },
  bash: { icon: Terminal, color: "var(--icon-shell)" },
  zsh: { icon: Terminal, color: "var(--icon-shell)" },
  fish: { icon: Terminal, color: "var(--icon-shell)" },
  ps1: { icon: Terminal, color: "var(--icon-shell)" },

  // Data / config
  json: { icon: Braces, color: "var(--icon-data)" },
  json5: { icon: Braces, color: "var(--icon-data)" },
  jsonc: { icon: Braces, color: "var(--icon-data)" },
  yml: { icon: FileJson, color: "var(--icon-data)" },
  yaml: { icon: FileJson, color: "var(--icon-data)" },
  toml: { icon: FileJson, color: "var(--icon-data)" },
  ini: { icon: FileJson, color: "var(--icon-data)" },
  env: { icon: Lock, color: "var(--icon-default)" },

  // Markup & docs
  html: { icon: FileCode, color: "var(--icon-markup)" },
  htm: { icon: FileCode, color: "var(--icon-markup)" },
  xml: { icon: FileCode, color: "var(--icon-markup)" },
  md: { icon: ScrollText, color: "var(--icon-default)" },
  mdx: { icon: ScrollText, color: "var(--icon-default)" },
  org: { icon: ScrollText, color: "var(--icon-default)" },
  rst: { icon: ScrollText, color: "var(--icon-default)" },
  txt: { icon: FileText, color: "var(--icon-default)" },
  adoc: { icon: ScrollText, color: "var(--icon-default)" },

  // Styles
  css: { icon: Palette, color: "var(--icon-style)" },
  scss: { icon: Palette, color: "var(--icon-style)" },
  sass: { icon: Palette, color: "var(--icon-style)" },
  less: { icon: Palette, color: "var(--icon-style)" },
  styl: { icon: Palette, color: "var(--icon-style)" },

  // Query / schema
  sql: { icon: FileCode, color: "var(--icon-data)" },
  graphql: { icon: FileCode, color: "var(--icon-ruby)" },
  gql: { icon: FileCode, color: "var(--icon-ruby)" },
  proto: { icon: FileCode, color: "var(--icon-markup)" },

  // Framework-y
  vue: { icon: FileCode, color: "var(--icon-go)" },
  svelte: { icon: FileCode, color: "var(--icon-rust)" },
  astro: { icon: FileCode, color: "var(--icon-markup)" },

  // Images
  png: { icon: FileImage, color: "var(--icon-image)" },
  jpg: { icon: FileImage, color: "var(--icon-image)" },
  jpeg: { icon: FileImage, color: "var(--icon-image)" },
  gif: { icon: FileImage, color: "var(--icon-image)" },
  svg: { icon: FileImage, color: "var(--icon-image)" },
  webp: { icon: FileImage, color: "var(--icon-image)" },
  ico: { icon: FileImage, color: "var(--icon-image)" },
  avif: { icon: FileImage, color: "var(--icon-image)" },
  bmp: { icon: FileImage, color: "var(--icon-image)" },

  // Fonts
  ttf: { icon: FileType, color: "var(--icon-image)" },
  otf: { icon: FileType, color: "var(--icon-image)" },
  woff: { icon: FileType, color: "var(--icon-image)" },
  woff2: { icon: FileType, color: "var(--icon-image)" },

  // Archives
  zip: { icon: FileArchive, color: "var(--icon-default)" },
  tar: { icon: FileArchive, color: "var(--icon-default)" },
  gz: { icon: FileArchive, color: "var(--icon-default)" },
  "7z": { icon: FileArchive, color: "var(--icon-default)" },
  rar: { icon: FileArchive, color: "var(--icon-default)" },

  // Infra / IaC
  tf: { icon: FileCog, color: "var(--icon-style)" },
  hcl: { icon: FileCog, color: "var(--icon-style)" },
};

export type FileIconProps = {
  filename: string;
  className?: string;
};

export function FileIcon({ filename, className }: FileIconProps) {
  const spec = pickSpec(filename);
  const Icon = spec.icon;
  // `color` inline wins over any CSS cascade, and since we reference a CSS
  // var it still swaps with the theme.
  return <Icon className={cn("size-3.5 flex-shrink-0", className)} style={{ color: spec.color }} />;
}

/** Directory icon — intentionally muted so language-colored files pop. */
export function DirIcon({ className }: { className?: string }) {
  return (
    <Dot
      className={cn("size-3.5 flex-shrink-0 text-[var(--color-fg-faint)]", className)}
    />
  );
}

function pickSpec(filename: string): IconSpec {
  const basename = (filename.split("/").pop() ?? filename).toLowerCase();

  // Exact-match special filenames
  const named = NAMED_MAP[basename];
  if (named) return named;

  // Files with multi-part extensions (.d.ts, .test.ts, etc.) — try the
  // longest tail we know about before falling back to the last segment.
  if (basename.endsWith(".d.ts")) return EXT_MAP["d.ts"] ?? DEFAULT_SPEC;

  const parts = basename.split(".");
  if (parts.length < 2) return DEFAULT_SPEC;
  const ext = parts[parts.length - 1]!;
  return EXT_MAP[ext] ?? DEFAULT_SPEC;
}
