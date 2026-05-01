import { Octokit } from "@octokit/core";
import type { OctokitResponse } from "@octokit/types";
import { logout } from "@/app/lib/auth";
import { useAuthStore } from "@/app/stores/auth";

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
  etag: string;
  data: unknown;
  status: number;
  url: string;
  headers: OctokitResponse<unknown>["headers"];
};

const etagCache = new Map<string, CachedResponse>();

function buildCacheKey(options: Record<string, unknown>): string {
  const method = String(options.method ?? "GET").toUpperCase();
  const url = String(options.url ?? "");
  const rest: Record<string, unknown> = {};
  for (const k of Object.keys(options).sort()) {
    if (k === "method" || k === "url" || k === "headers") continue;
    if (k === "request" || k === "mediaType" || k === "baseUrl") continue;
    rest[k] = options[k];
  }
  return `${method} ${url} ${JSON.stringify(rest)}`;
}

function rememberETag(key: string, response: OctokitResponse<unknown>): void {
  const etag = response.headers?.etag;
  if (typeof etag !== "string") return;
  if (etagCache.size >= ETAG_CACHE_MAX) {
    const first = etagCache.keys().next().value;
    if (first !== undefined) etagCache.delete(first);
  }
  etagCache.set(key, {
    etag,
    data: response.data,
    status: response.status,
    url: response.url,
    headers: response.headers,
  });
}

export function clearETagCache(): void {
  etagCache.clear();
}

function evictETagsForRepo(owner: string, repo: string): void {
  const needle = `/${owner}/${repo}`;
  for (const key of etagCache.keys()) {
    if (key.includes(needle)) etagCache.delete(key);
  }
}

// ─── Client singleton ──────────────────────────────────────────────────────

let cached: { token: string; client: Octokit } | null = null;

export function getGitHubClient(): Octokit {
  const token = useAuthStore.getState().token;
  if (!token) throw new Error("Not authenticated");
  if (cached && cached.token === token) return cached.client;

  // Token changed — the new session may see different visibility, so drop
  // the ETag cache rather than serve a previous user's cached bodies.
  if (cached && cached.token !== token) clearETagCache();

  const noCacheFetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    globalThis.fetch(input, { ...init, cache: "no-store" })) as typeof fetch;

  const client = new Octokit({
    auth: token,
    userAgent: "githut/0.1",
    request: { fetch: noCacheFetch },
  });

  client.hook.wrap("request", async (request, options) => {
    const method = String(options.method ?? "GET").toUpperCase();
    const versionedOptions = {
      ...options,
      headers: {
        ...options.headers,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    };

    if (method !== "GET") {
      const response = await request(versionedOptions);
      // After any write, evict cached GET responses for the same repo so
      // subsequent refetches bypass the ETag 304 path and get fresh data.
      const url = String(options.url ?? "");
      const match = url.match(/\/repos\/([^/]+)\/([^/]+)/);
      if (match?.[1] && match[2]) evictETagsForRepo(match[1], match[2]);
      return response;
    }

    const key = buildCacheKey(options as Record<string, unknown>);
    const prev = etagCache.get(key);
    const opts = prev
      ? {
          ...versionedOptions,
          headers: { ...versionedOptions.headers, "if-none-match": prev.etag },
        }
      : versionedOptions;

    try {
      const response = await request(opts);
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
        return {
          data: prev.data,
          headers: prev.headers,
          status: 200,
          url: prev.url,
        } as OctokitResponse<unknown>;
      }
      throw err;
    }
  });

  // If the token is revoked or expired GitHub returns 401.
  // Clear the session immediately so the user is sent back to login.
  client.hook.error("request", (error) => {
    if ("status" in error && error.status === 401) {
      cached = null;
      clearETagCache();
      logout();
    }
    throw error;
  });

  cached = { token, client };
  return cached.client;
}
