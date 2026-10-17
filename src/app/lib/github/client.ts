import { Octokit } from "@octokit/core";
import type { OctokitResponse } from "@octokit/types";
import { assertCanMutate } from "@/app/lib/connectivity";
import { useAuthStore } from "@/app/stores/auth";
import { clearRateLimit, recordRateLimit } from "@/app/stores/rateLimit";

// ─── ETag cache ────────────────────────────────────────────────────────────
//
// GitHub supports conditional requests (RFC 7232). When we send
// `If-None-Match: <etag>` and the resource is unchanged, GitHub returns
// 304 Not Modified — which does NOT count against the primary rate limit
// (5,000/hr for authenticated requests). So caching ETags dramatically
// extends rate-limit headroom across TanStack Query refetches.
//
// Keyed by method + URL + query params so two different params to the same
// endpoint get independent entries. Bounded by a simple FIFO eviction so
// a long session can't balloon memory.

const ETAG_CACHE_MAX = 500;

type CachedResponse = {
  etag?: string;
  lastModified?: string;
  data: unknown;
  status: number;
  url: string;
  headers: OctokitResponse<unknown>["headers"];
};

const etagCache = new Map<string, CachedResponse>();

/**
 * Keyed by the expanded URL (`/repos/acme/app/pulls?page=2`), never the route
 * template, so repo-scoped eviction can match real paths. The accept header
 * is part of the key: the same URL can return different media types.
 */
function buildCacheKey(endpoint: { method: string; url: string; headers: object }): string {
  const accept = (endpoint.headers as Record<string, unknown>).accept ?? "";
  return `${endpoint.method.toUpperCase()} ${endpoint.url} ${String(accept)}`;
}

/** Least recently used first: a hit moves the entry to the end. */
function touchETag(key: string): CachedResponse | undefined {
  const entry = etagCache.get(key);
  if (entry) {
    etagCache.delete(key);
    etagCache.set(key, entry);
  }
  return entry;
}

function rememberETag(key: string, response: OctokitResponse<unknown>): void {
  const etag = response.headers?.etag;
  const lastModified = response.headers?.["last-modified"];
  if (typeof etag !== "string" && typeof lastModified !== "string") return;
  etagCache.delete(key);
  if (etagCache.size >= ETAG_CACHE_MAX) {
    const oldest = etagCache.keys().next().value;
    if (oldest !== undefined) etagCache.delete(oldest);
  }
  etagCache.set(key, {
    etag: typeof etag === "string" ? etag : undefined,
    lastModified: typeof lastModified === "string" ? lastModified : undefined,
    data: response.data,
    status: response.status,
    url: response.url,
    headers: response.headers,
  });
}

export function clearETagCache(): void {
  etagCache.clear();
}

/** Drop cached GETs for one repo: its REST paths and searches qualified with `repo:owner/name`. */
function evictETagsForRepo(owner: string, repo: string): void {
  const path = `/repos/${owner}/${repo}`.toLowerCase();
  const search = encodeURIComponent(`repo:${owner}/${repo}`).toLowerCase();
  for (const key of etagCache.keys()) {
    const lower = key.toLowerCase();
    if (
      lower.includes(`${path}/`) ||
      lower.includes(`${path}?`) ||
      lower.includes(`${path} `) ||
      lower.includes(search)
    )
      etagCache.delete(key);
  }
}

/** GraphQL queries and Markdown rendering are POSTs that change nothing. */
function isRead(method: string, url: string, options: Record<string, unknown>): boolean {
  if (method === "GET" || method === "HEAD") return true;
  if (url === "/markdown" || url === "/markdown/raw") return true;
  if (url === "/graphql") {
    const query = typeof options.query === "string" ? options.query.trimStart() : "";
    return !query.startsWith("mutation");
  }
  return false;
}

// ─── Client singleton ──────────────────────────────────────────────────────

let cached: { token: string; client: Octokit } | null = null;

function sessionExpiredError(): Error {
  return Object.assign(new Error("GitHub sign-in expired"), { status: 401 });
}

/**
 * Switch to a fresh token after signing in again. The ETag cache is kept when
 * the new token belongs to the same user (cheap 304 refetches); otherwise the
 * previous user's cached bodies are dropped.
 */
export function adoptToken(
  token: string,
  { sameUser, accountId }: { sameUser: boolean; accountId?: number },
): void {
  cached = null;
  if (!sameUser) {
    clearETagCache();
    clearRateLimit();
  }
  useAuthStore.getState().setToken(token, accountId);
}

export function getGitHubClient(): Octokit {
  const token = useAuthStore.getState().token;
  if (!token) throw new Error("Not authenticated");
  if (cached && cached.token === token) return cached.client;

  // Token changed — the new session may see different visibility, so drop
  // the ETag cache rather than serve a previous user's cached bodies.
  if (cached && cached.token !== token) {
    clearETagCache();
    clearRateLimit();
  }

  const noCacheFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await globalThis.fetch(input, { ...init, cache: "no-store" });
    if (useAuthStore.getState().token === token) recordRateLimit(response.headers);
    return response;
  }) as typeof fetch;

  const client = new Octokit({
    auth: token,
    userAgent: "githut/0.1",
    request: { fetch: noCacheFetch },
  });

  client.hook.wrap("request", async (request, options) => {
    // Known-dead token: fail like GitHub would without spending a request.
    if (useAuthStore.getState().expired) throw sessionExpiredError();

    const method = String(options.method ?? "GET").toUpperCase();
    // Earlier Octokit hooks hold this options object. Replacing it loses
    // headers through that hook chain; update the shared options in place.
    options.headers = {
      ...options.headers,
      "x-github-api-version": "2022-11-28",
    };

    if (method !== "GET") {
      const url = String(options.url ?? "");
      if (isRead(method, url, options as Record<string, unknown>)) return request(options);
      assertCanMutate();
      const response = await request(options);
      // After any write, evict cached GET responses for the same repo so
      // subsequent refetches bypass the ETag 304 path and get fresh data.
      // `options.url` is the route template; the expanded URL has the real repo.
      const path = new URL(client.request.endpoint.parse(options).url).pathname;
      const match = path.match(/^\/repos\/([^/]+)\/([^/]+)/);
      if (match?.[1] && match[2])
        evictETagsForRepo(decodeURIComponent(match[1]), decodeURIComponent(match[2]));
      if (path.startsWith("/notifications")) {
        for (const key of etagCache.keys()) {
          if (key.includes("/notifications")) etagCache.delete(key);
        }
      }
      return response;
    }

    const key = buildCacheKey(client.request.endpoint.parse(options));
    const prev = touchETag(key);
    if (prev?.etag) options.headers["if-none-match"] = prev.etag;
    else if (prev?.lastModified) options.headers["if-modified-since"] = prev.lastModified;

    try {
      const response = await request(options);
      if (response.status === 304 && prev) {
        return {
          data: prev.data,
          headers: response.headers,
          status: 200,
          url: response.url,
        } as OctokitResponse<unknown>;
      }
      rememberETag(key, response);
      return response;
    } catch (err) {
      if (err && typeof err === "object" && "status" in err && err.status === 304 && prev) {
        const response = (err as { response?: { headers?: CachedResponse["headers"] } }).response;
        return {
          data: prev.data,
          headers: { ...prev.headers, ...response?.headers },
          status: 200,
          url: prev.url,
        } as OctokitResponse<unknown>;
      }
      throw err;
    }
  });

  // If the token is revoked or expired GitHub returns 401. Don't sign out:
  // mark the session expired so the workspace (tabs, drafts, cached pages)
  // stays put and a banner offers to sign in again (see lib/session.ts).
  client.hook.error("request", (error) => {
    if ("status" in error && error.status === 401 && useAuthStore.getState().token === token) {
      useAuthStore.getState().markExpired();
    }
    throw error;
  });

  cached = { token, client };
  return cached.client;
}
