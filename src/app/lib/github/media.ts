import { useAuthStore } from "@/app/stores/auth";

/**
 * Media + binary detection for repository paths, plus URL helpers for loading
 * file bytes straight from GitHub. Shared by the diff viewer and the markdown
 * renderers so every surface agrees on what counts as an image.
 */
export type MediaKind = "image" | "video" | "audio";

const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "avif",
  "apng",
  "bmp",
  "ico",
  "svg",
]);
const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "m4v", "ogv"]);
const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "ogg", "oga", "m4a", "aac", "flac", "opus"]);

/** Binary formats the browser can't preview and we should never diff as text. */
const OTHER_BINARY_EXTENSIONS = new Set([
  "tif",
  "tiff",
  "psd",
  "ai",
  "heic",
  "heif",
  "ttf",
  "otf",
  "woff",
  "woff2",
  "eot",
  "zip",
  "tar",
  "gz",
  "tgz",
  "bz2",
  "xz",
  "7z",
  "rar",
  "pdf",
  "exe",
  "dll",
  "so",
  "dylib",
  "wasm",
  "bin",
  "class",
  "jar",
  "pyc",
  "o",
  "a",
  "sqlite",
  "db",
  "lockb",
]);

export function extensionOf(path: string): string {
  const base = path.split("/").pop() ?? path;
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
}

export function mediaKindForPath(path: string): MediaKind | null {
  const ext = extensionOf(path);
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  if (AUDIO_EXTENSIONS.has(ext)) return "audio";
  return null;
}

/** True for paths whose bytes are not text. SVG is XML, so it stays diffable. */
export function isBinaryPath(path: string): boolean {
  const ext = extensionOf(path);
  if (ext === "svg") return false;
  return mediaKindForPath(path) !== null || OTHER_BINARY_EXTENSIONS.has(ext);
}

function encodePathSegments(value: string): string {
  return value.split("/").map(encodeURIComponent).join("/");
}

/** Raw bytes of a file at a ref. Private repos need the token — see `proxyGitHubImage`. */
export function rawFileUrl(owner: string, repo: string, ref: string, path: string): string {
  return `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(
    repo,
  )}/${encodePathSegments(ref)}/${encodePathSegments(path)}`;
}

/** Human-facing GitHub page for a file at a ref. */
export function githubBlobUrl(owner: string, repo: string, ref: string, path: string): string {
  return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(
    repo,
  )}/blob/${encodePathSegments(ref)}/${encodePathSegments(path)}`;
}

/**
 * Media elements can't send an Authorization header, so GitHub-hosted assets
 * are routed through the worker proxy with the session token when one exists.
 * Non-GitHub URLs and anonymous sessions pass through untouched.
 */
export function proxyGitHubImage(src: string): string {
  try {
    const u = new URL(src);
    const host = u.hostname;
    if (host !== "github.com" && !host.endsWith(".githubusercontent.com")) return src;
  } catch {
    return src;
  }
  const token = useAuthStore.getState().token;
  if (!token) return src;
  return `/api/github-image?url=${encodeURIComponent(src)}&token=${encodeURIComponent(token)}`;
}
