import { afterEach, expect, test } from "bun:test";
import { clearETagCache, getGitHubClient } from "@/app/lib/github/client";
import { useAuthStore } from "@/app/stores/auth";
import { clearRateLimit, expireRateLimit, getRateBackoff } from "@/app/stores/rateLimit";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  useAuthStore.setState({ token: null });
  clearETagCache();
  clearRateLimit();
});

test("conditional GET reuses the body and still observes rate headers from a 304 response", async () => {
  useAuthStore.setState({ token: "freshness-fixture" });
  const requests: Headers[] = [];
  const reset = Math.floor(Date.now() / 1000) + 60;
  globalThis.fetch = (async (_input, init) => {
    requests.push(new Headers(init?.headers));
    return requests.length === 1
      ? Response.json({ comments: 2 }, { headers: { etag: '"comments-1"' } })
      : new Response(null, {
          status: 304,
          headers: {
            "x-ratelimit-limit": "5000",
            "x-ratelimit-remaining": "499",
            "x-ratelimit-reset": String(reset),
            "x-poll-interval": "120",
          },
        });
  }) as typeof fetch;
  const client = getGitHubClient();
  await client.request("GET /repos/demo/repo/issues/1");
  const unchanged = await client.request("GET /repos/demo/repo/issues/1");
  expect(requests[1]!.get("if-none-match")).toBe('"comments-1"');
  expect(unchanged.data).toEqual({ comments: 2 });
  expect(unchanged.headers["x-poll-interval"]).toBe("120");
  expect(getRateBackoff()).toBe(4);
  expireRateLimit(reset * 1000);
  expect(getRateBackoff()).toBe(1);
});
