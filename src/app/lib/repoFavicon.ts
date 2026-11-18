/**
 * Repo favicons — a repo's own icon, shown in place of its letter mark
 * (GLOSSARY → Repo mark) when the repository ships one.
 *
 * Lookup: one GraphQL request asks a batch of repos for a fixed list of
 * conventional favicon paths on their default branch (`HEAD:<path>`). The
 * first hit under the size cap wins. Repos that miss every conventional path
 * get one recursive tree listing, and the shallowest favicon-like file outside
 * examples, fixtures, tests and the like wins (`pickFromTree`). Bytes come
 * from the git blob API by oid, so private repos work with the session token
 * like everything else.
 *
 * Cache: results — hits as data URLs, misses as `null` — live in memory for
 * synchronous renders and in IndexedDB so a reload never refetches. Entries
 * are revalidated after a TTL; a revalidation whose blob oid is unchanged
 * keeps the stored bytes. Failures (offline, rate limit) are not persisted
 * and retry after a short backoff. Icons from private repos belong to one
 * verified account, so the store is keyed per account and sign-out clears it.
 */
import { clear, createStore, entries, set, type UseStore } from "idb-keyval";
import { getGitHubClient } from "@/app/lib/github/client";
import { extensionOf } from "@/app/lib/github/media";
import { useAuthStore } from "@/app/stores/auth";
import { getRateBackoff } from "@/app/stores/rateLimit";

// ─── Lookup rules (pure) ───────────────────────────────────────────────────

/**
 * Where repos keep their favicon, in preference order: the repo root and the
 * usual static folders of common web frameworks (Vite/CRA `public`, Next.js
 * `app`, SvelteKit/Hugo `static`, Angular `src`), then docs sites and the
 * usual monorepo app folders. SVG first at each location: it stays sharp at
 * mark size.
 */
export const FAVICON_PATHS: readonly string[] = [
  "favicon.svg",
  "favicon.ico",
  "favicon.png",
  "public/favicon.svg",
  "public/favicon.ico",
  "public/favicon.png",
  "static/favicon.svg",
  "static/favicon.ico",
  "static/favicon.png",
  "app/icon.svg",
  "app/icon.png",
  "app/favicon.ico",
  "src/app/icon.svg",
  "src/app/icon.png",
  "src/app/favicon.ico",
  "src/favicon.svg",
  "src/favicon.ico",
  "src/favicon.png",
  "assets/favicon.svg",
  "assets/favicon.ico",
  "assets/favicon.png",
  "src/assets/favicon.svg",
  "src/assets/favicon.ico",
  "src/assets/favicon.png",
  "docs/favicon.svg",
  "docs/favicon.ico",
  "docs/public/favicon.svg",
  "docs/public/favicon.ico",
  "web/public/favicon.svg",
  "web/public/favicon.ico",
  "apps/web/public/favicon.svg",
  "apps/web/public/favicon.ico",
  "apps/web/app/favicon.ico",
  "frontend/public/favicon.svg",
  "frontend/public/favicon.ico",
  "client/public/favicon.svg",
  "client/public/favicon.ico",
];

/** Bigger files are artwork, not icons, and would bloat the cache. */
export const MAX_FAVICON_BYTES = 128 * 1024;
/** Repos per GraphQL request. */
export const BATCH_SIZE = 8;
/** Found and missing icons are both rechecked weekly: a miss can mean a full tree scan. */
export const HIT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const MISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** A failed lookup (offline, rate limited) is retried after this. */
export const ERROR_BACKOFF_MS = 10 * 60 * 1000;

const MIME_BY_EXTENSION: Record<string, string> = {
  svg: "image/svg+xml",
  ico: "image/x-icon",
  png: "image/png",
};

export type FaviconEntry = {
  /** Data URL of the icon, or `null` when the repo has none. */
  src: string | null;
  /** Blob oid the `src` was read from; lets a revalidation skip the download. */
  oid: string | null;
  checkedAt: number;
};

type BlobRef = { oid: string; byteSize: number } | null;
export type RepoFaviconResult = Record<string, BlobRef> | null;

/** `owner/name`, case-insensitive. */
export function repoKey(fullName: string): string {
  return fullName.toLowerCase();
}

/** Splits `owner/name`; anything else is not a repo we can look up. */
export function parseRepo(fullName: string): { owner: string; name: string } | null {
  const [owner, name, ...rest] = fullName.split("/");
  if (!owner || !name || rest.length > 0) return null;
  return { owner, name };
}

/** One query for a batch of repos; owners and names travel as variables. */
export function buildFaviconQuery(count: number): string {
  const params: string[] = [];
  const repos: string[] = [];
  const fields = FAVICON_PATHS.map(
    (path, j) => `p${j}: object(expression: ${JSON.stringify(`HEAD:${path}`)}) { ...F }`,
  ).join("\n    ");
  for (let i = 0; i < count; i++) {
    params.push(`$o${i}: String!, $n${i}: String!`);
    repos.push(`r${i}: repository(owner: $o${i}, name: $n${i}) {\n    ${fields}\n  }`);
  }
  return `query RepoFavicons(${params.join(", ")}) {\n  ${repos.join("\n  ")}\n}\nfragment F on GitObject { ... on Blob { oid byteSize } }`;
}

export function faviconVariables(
  repos: readonly { owner: string; name: string }[],
): Record<string, string> {
  const variables: Record<string, string> = {};
  repos.forEach((repo, i) => {
    variables[`o${i}`] = repo.owner;
    variables[`n${i}`] = repo.name;
  });
  return variables;
}

/** The first candidate that exists and is small enough. */
export function pickFavicon(result: RepoFaviconResult): { path: string; oid: string } | null {
  if (!result) return null;
  for (let j = 0; j < FAVICON_PATHS.length; j++) {
    const blob = result[`p${j}`];
    if (blob?.oid && blob.byteSize > 0 && blob.byteSize <= MAX_FAVICON_BYTES)
      return { path: FAVICON_PATHS[j]!, oid: blob.oid };
  }
  return null;
}

export type TreeEntry = { path: string; type: string; sha: string; size?: number };

/**
 * Folders whose icons belong to something else: sample apps, test apps,
 * vendored code, editor extensions' assets and dot-folders. Matched per path
 * segment, so `sfc-playground/` and `template-react/` count too.
 */
const FOREIGN_SEGMENT =
  /^(?:\..+|node_modules|vendor|third[-_]party|tests?|__tests__|__fixtures__|spec|e2e|.*(?:example|fixture|playground|template|demo|sample|bench|sandbox|starter|scaffold|integration).*)$/i;

/** Favicons first, then logos, then Next.js `app/icon.*`. */
function nameRank(path: string): number {
  const parts = path.split("/");
  const base = parts[parts.length - 1]!.toLowerCase();
  if (/^favicon\.(?:svg|png|ico)$/.test(base)) return 0;
  if (/^logo\.(?:svg|png)$/.test(base)) return 1;
  if (/^icon\.(?:svg|png)$/.test(base) && parts[parts.length - 2] === "app") return 2;
  return -1;
}

const EXTENSION_RANK: Record<string, number> = { svg: 0, png: 1, ico: 2 };

/**
 * The repo's own icon from a recursive tree listing: the shallowest
 * favicon-like file outside foreign folders. Ties prefer favicon over logo,
 * then SVG over PNG over ICO, then the shorter path.
 */
export function pickFromTree(tree: readonly TreeEntry[]): { path: string; oid: string } | null {
  let best: { path: string; oid: string; key: number[] } | null = null;
  for (const entry of tree) {
    if (entry.type !== "blob" || !entry.size || entry.size > MAX_FAVICON_BYTES) continue;
    const rank = nameRank(entry.path);
    if (rank < 0) continue;
    const segments = entry.path.split("/");
    if (segments.slice(0, -1).some((segment) => FOREIGN_SEGMENT.test(segment))) continue;
    const key = [
      segments.length,
      rank,
      EXTENSION_RANK[extensionOf(entry.path)] ?? 3,
      entry.path.length,
    ];
    if (!best || compareKeys(key, best.key) < 0) best = { path: entry.path, oid: entry.sha, key };
  }
  return best && { path: best.path, oid: best.oid };
}

function compareKeys(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i]! - b[i]!;
  return 0;
}

/** Data URL for a file's base64 content (GitHub wraps it at 60 columns). */
export function faviconDataUrl(path: string, base64: string): string {
  const mime = MIME_BY_EXTENSION[extensionOf(path)] ?? "application/octet-stream";
  return `data:${mime};base64,${base64.replace(/\s/g, "")}`;
}

export function isFresh(entry: FaviconEntry, now: number): boolean {
  return now - entry.checkedAt < (entry.src ? HIT_TTL_MS : MISS_TTL_MS);
}

function isEntry(value: unknown): value is FaviconEntry {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    (v.src === null || (typeof v.src === "string" && v.src.startsWith("data:image/"))) &&
    (v.oid === null || typeof v.oid === "string") &&
    typeof v.checkedAt === "number"
  );
}

// ─── Store ─────────────────────────────────────────────────────────────────

let idb: UseStore | null = null;
function store(): UseStore | null {
  if (typeof indexedDB === "undefined") return null;
  idb ??= createStore("githut-repo-favicons", "icons");
  return idb;
}

const idbKey = (account: number, key: string) => `${account}:${key}`;

const memory = new Map<string, FaviconEntry>();
/** The account `memory` belongs to; `undefined` until hydration starts. */
let owner: number | null | undefined;
let hydrating: Promise<void> | null = null;
let hydrated = false;
const failedAt = new Map<string, number>();
const queued = new Set<string>();
const inflight = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Map<string, Set<() => void>>();

function notify(key: string) {
  for (const fn of listeners.get(key) ?? []) fn();
}

function notifyAll() {
  for (const fns of listeners.values()) for (const fn of fns) fn();
}

function currentAccount(): number | null {
  return useAuthStore.getState().accountId;
}

function hydrate(): Promise<void> {
  const account = currentAccount();
  if (owner === account && hydrating) return hydrating;
  owner = account;
  hydrated = false;
  hydrating = (async () => {
    const db = store();
    if (account != null && db) {
      const prefix = `${account}:`;
      try {
        for (const [k, value] of await entries<string, unknown>(db)) {
          // The account changed while reading: the newer hydration owns memory.
          if (owner !== account) return;
          if (typeof k !== "string" || !k.startsWith(prefix) || !isEntry(value)) continue;
          const key = k.slice(prefix.length);
          // A lookup that finished during hydration is newer than storage.
          if (!memory.has(key)) memory.set(key, value);
        }
      } catch {
        // Storage unavailable: fall back to fetching, unpersisted.
      }
    }
    if (owner !== account) return;
    hydrated = true;
    notifyAll();
    requeueWatched();
  })();
  return hydrating;
}

// A different account never sees the previous one's icons, even in memory.
useAuthStore.subscribe((state, previous) => {
  if (state.accountId === previous.accountId) {
    // Signed in again after the session expired: retry what failed meanwhile.
    if (state.token !== previous.token || state.expired !== previous.expired) {
      failedAt.clear();
      requeueWatched();
    }
    return;
  }
  memory.clear();
  failedAt.clear();
  queued.clear();
  owner = undefined;
  hydrating = null;
  hydrated = false;
  notifyAll();
  if (listeners.size) void hydrate();
});

function remember(key: string, entry: FaviconEntry) {
  const account = owner;
  memory.set(key, entry);
  notify(key);
  const db = store();
  if (account != null && db) void set(idbKey(account, key), entry, db).catch(() => {});
}

function canFetch(): boolean {
  const { token, expired, accountId } = useAuthStore.getState();
  return !!token && !expired && accountId != null && owner === accountId;
}

function isStale(key: string, now: number): boolean {
  const entry = memory.get(key);
  return !entry || !isFresh(entry, now);
}

function needsLookup(key: string, now: number): boolean {
  if (queued.has(key) || inflight.has(key)) return false;
  const failed = failedAt.get(key);
  if (failed !== undefined && now - failed < ERROR_BACKOFF_MS) return false;
  return isStale(key, now);
}

/** Ask again for every repo on screen that still needs a lookup. */
function requeueWatched() {
  const now = Date.now();
  for (const key of listeners.keys()) if (parseRepo(key) && needsLookup(key, now)) queued.add(key);
  flushSoon();
}

let retryTimer: ReturnType<typeof setTimeout> | null = null;
/** Marks stay mounted, so nothing else would ask again once a backoff ends. */
function retryLater(ms: number) {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    requeueWatched();
  }, ms);
}

function markFailed(keys: readonly string[]) {
  const now = Date.now();
  for (const key of keys) failedAt.set(key, now);
  retryLater(ERROR_BACKOFF_MS + 1000);
}

function flushSoon() {
  if (flushTimer || queued.size === 0 || !hydrated) return;
  // Collect the marks a render pass mounts into one request.
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, 50);
}

/** Icons are decoration: they wait whenever GitHub asks us to slow down. */
function rateLimited(): boolean {
  return getRateBackoff("graphql") > 1 || getRateBackoff("core") > 1;
}

async function flush() {
  // Not signed in (or not verified yet): `requeueWatched` asks again once we are.
  if (!canFetch()) {
    queued.clear();
    return;
  }
  // Storage may have answered since these were queued.
  const now = Date.now();
  const keys = [...queued].filter((key) => isStale(key, now));
  queued.clear();
  for (const key of keys) inflight.add(key);
  // One batch at a time, so a page with hundreds of repos can't burst.
  for (let i = 0; i < keys.length; i += BATCH_SIZE) {
    const batch = keys.slice(i, i + BATCH_SIZE);
    if (!canFetch() || rateLimited()) {
      for (const key of keys.slice(i)) inflight.delete(key);
      retryLater(60_000);
      return;
    }
    try {
      await lookup(batch);
    } finally {
      for (const key of batch) inflight.delete(key);
    }
  }
}

type GraphqlError = { type?: string; path?: readonly (string | number)[] };

async function lookup(keys: string[]) {
  const account = owner;
  const repos = keys.map((key) => parseRepo(key)!);
  let data: Record<string, RepoFaviconResult> | null = null;
  let errors: GraphqlError[] = [];
  try {
    data = await getGitHubClient().graphql<Record<string, RepoFaviconResult>>(
      buildFaviconQuery(repos.length),
      faviconVariables(repos),
    );
  } catch (error) {
    // Partial success: a repo that is gone or not visible errors alone; the
    // others still answer.
    const partial = error as { data?: unknown; errors?: unknown } | null;
    if (!partial?.data || typeof partial.data !== "object") {
      markFailed(keys);
      return;
    }
    data = partial.data as Record<string, RepoFaviconResult>;
    errors = Array.isArray(partial.errors) ? (partial.errors as GraphqlError[]) : [];
  }
  if (owner !== account) return;
  // An error not tied to one repo leaves every answer in doubt.
  if (errors.some((e) => typeof e.path?.[0] !== "string")) {
    markFailed(keys);
    return;
  }

  // One repo at a time: a tree listing can run to megabytes.
  for (const [i, key] of keys.entries()) {
    if (owner !== account) return;
    // Only "no such repo" is a real answer. SSO enforcement, timeouts and
    // the like are not, so they retry instead of caching a miss.
    const own = errors.filter((e) => e.path?.[0] === `r${i}`);
    if (own.some((e) => e.type !== "NOT_FOUND")) {
      markFailed([key]);
      continue;
    }
    const result = data?.[`r${i}`] ?? null;
    try {
      const pick = result ? (pickFavicon(result) ?? (await scanTree(repos[i]!))) : null;
      if (owner !== account) return;
      await resolve(key, repos[i]!, pick);
    } catch {
      markFailed([key]);
    }
  }
}

/** No conventional path matched: look through the whole tree. */
async function scanTree(repo: { owner: string; name: string }) {
  try {
    const { data } = await getGitHubClient().request(
      "GET /repos/{owner}/{repo}/git/trees/{tree_sha}",
      { owner: repo.owner, repo: repo.name, tree_sha: "HEAD", recursive: "1" },
    );
    // A truncated listing (huge repos) still holds the shallow paths first.
    return pickFromTree(data.tree as TreeEntry[]);
  } catch (error) {
    // An empty repository has no HEAD: nothing to find.
    const status = (error as { status?: number } | null)?.status;
    if (status === 404 || status === 409) return null;
    throw error;
  }
}

async function resolve(
  key: string,
  repo: { owner: string; name: string },
  pick: { path: string; oid: string } | null,
) {
  const account = owner;
  const now = Date.now();
  if (!pick) {
    remember(key, { src: null, oid: null, checkedAt: now });
    return;
  }
  const previous = memory.get(key);
  if (previous?.src && previous.oid === pick.oid) {
    remember(key, { ...previous, checkedAt: now });
    return;
  }
  const { data: blob } = await getGitHubClient().request(
    "GET /repos/{owner}/{repo}/git/blobs/{file_sha}",
    { owner: repo.owner, repo: repo.name, file_sha: pick.oid },
  );
  if (owner !== account) return;
  if (blob.encoding !== "base64") throw new Error(`Unexpected encoding ${blob.encoding}`);
  remember(key, { src: faviconDataUrl(pick.path, blob.content), oid: pick.oid, checkedAt: now });
}

// ─── Public API ────────────────────────────────────────────────────────────

/** Current icon for a repo (`undefined`: not known yet, `null`: none). */
export function getRepoFavicon(fullName: string): string | null | undefined {
  if (owner !== currentAccount()) return undefined;
  return memory.get(repoKey(fullName))?.src;
}

/**
 * Watch one repo's icon. Subscribing asks for it: from storage first, then
 * from GitHub when missing or stale.
 */
export function subscribeRepoFavicon(fullName: string, fn: () => void): () => void {
  const key = repoKey(fullName);
  const fns = listeners.get(key) ?? new Set<() => void>();
  listeners.set(key, fns);
  fns.add(fn);
  if (parseRepo(key)) {
    if (owner !== currentAccount() || !hydrating) void hydrate();
    // Before hydration, storage may still have it: hydration requeues what it lacks.
    else if (hydrated && needsLookup(key, Date.now())) {
      queued.add(key);
      flushSoon();
    }
  }
  return () => {
    fns.delete(fn);
    if (fns.size === 0) listeners.delete(key);
  };
}

/** The `<img>` could not decode the stored icon: fall back to the letter until the next check. */
export function markRepoFaviconBroken(fullName: string): void {
  const key = repoKey(fullName);
  const entry = memory.get(key);
  if (!entry?.src) return;
  remember(key, { src: null, oid: entry.oid, checkedAt: Date.now() });
}

/** Sign-out: forget every cached icon on this device. */
export async function forgetRepoFavicons(): Promise<void> {
  memory.clear();
  failedAt.clear();
  queued.clear();
  owner = undefined;
  hydrating = null;
  hydrated = false;
  notifyAll();
  const db = store();
  if (db) await clear(db);
}

// Start reading storage now rather than when the first mark mounts, so cached
// icons replace the letters as early as possible.
void hydrate();
