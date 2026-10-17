import { create } from "zustand";

/** The latest low-quota reset across GitHub's core, search and GraphQL buckets. */
export const useRateLimitStore = create<{ slowUntil: number }>(() => ({ slowUntil: 0 }));

export function recordRateLimit(headers: Headers) {
  const limit = Number(headers.get("x-ratelimit-limit"));
  const remaining = Number(headers.get("x-ratelimit-remaining"));
  const resetAt = Number(headers.get("x-ratelimit-reset")) * 1000;
  if (
    headers.has("x-ratelimit-remaining") &&
    limit > 0 &&
    remaining >= 0 &&
    remaining / limit < 0.1 &&
    resetAt > Date.now()
  ) {
    useRateLimitStore.setState((state) => ({ slowUntil: Math.max(state.slowUntil, resetAt) }));
  }
}

export function getRateBackoff(now = Date.now()): 1 | 4 {
  return useRateLimitStore.getState().slowUntil > now ? 4 : 1;
}

export function expireRateLimit(now = Date.now()) {
  const until = useRateLimitStore.getState().slowUntil;
  if (until && until <= now) clearRateLimit();
}

export function clearRateLimit() {
  useRateLimitStore.setState({ slowUntil: 0 });
}
