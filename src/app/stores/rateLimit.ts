import { create } from "zustand";

/**
 * GitHub meters each resource separately (`x-ratelimit-resource`): core REST,
 * GraphQL points and the 30-a-minute search bucket. A low bucket only slows
 * the requests that draw from it.
 */
export type RateResource = "core" | "graphql" | "search" | (string & {});

type Bucket = {
  /** Fewer than 10% left: polling from this bucket runs 4× slower until then. */
  slowUntil: number;
  /** Nothing left: polling from this bucket stops until then. */
  pausedUntil: number;
};

export const useRateLimitStore = create<{ buckets: Record<string, Bucket> }>(() => ({
  buckets: {},
}));

const timers = new Map<string, ReturnType<typeof setTimeout>>();

export function recordRateLimit(headers: Headers) {
  if (!headers.has("x-ratelimit-remaining")) return;
  const resource = headers.get("x-ratelimit-resource") || "core";
  const limit = Number(headers.get("x-ratelimit-limit"));
  const remaining = Number(headers.get("x-ratelimit-remaining"));
  const resetAt = Number(headers.get("x-ratelimit-reset")) * 1000;
  if (!(limit > 0) || !(remaining >= 0) || !(resetAt > Date.now())) return;
  const slow = remaining / limit < 0.1;
  const current = useRateLimitStore.getState().buckets[resource];
  if (!slow && !current) return;
  const next: Bucket = slow
    ? {
        slowUntil: Math.max(current?.slowUntil ?? 0, resetAt),
        pausedUntil: remaining === 0 ? resetAt : 0,
      }
    : // A fresh window (or someone else's budget freed up): resume normally.
      { slowUntil: 0, pausedUntil: 0 };
  if (current?.slowUntil === next.slowUntil && current.pausedUntil === next.pausedUntil) return;
  useRateLimitStore.setState((state) => {
    const { [resource]: _, ...rest } = state.buckets;
    return { buckets: next.slowUntil ? { ...rest, [resource]: next } : rest };
  });
  clearTimeout(timers.get(resource));
  // Subscribers (polling intervals, the notice) resume on their own at reset.
  if (next.slowUntil)
    timers.set(
      resource,
      setTimeout(() => expireRateLimit(), next.slowUntil - Date.now() + 1000),
    );
}

/** Polling multiplier for one bucket: 1, 4 while low, Infinity while exhausted. */
export function getRateBackoff(resource: RateResource = "core", now = Date.now()): number {
  return bucketBackoff(useRateLimitStore.getState().buckets[resource], now);
}

export function bucketBackoff(bucket: Bucket | undefined, now = Date.now()): number {
  if (!bucket) return 1;
  if (bucket.pausedUntil > now) return Infinity;
  return bucket.slowUntil > now ? 4 : 1;
}

/** The reset time behind the "Updates slowed" notice. Search alone never raises it. */
export function noticeUntil(buckets: Record<string, Bucket>, now = Date.now()): number {
  return Math.max(
    0,
    ...["core", "graphql"].map((name) => {
      const until = buckets[name]?.slowUntil ?? 0;
      return until > now ? until : 0;
    }),
  );
}

export function expireRateLimit(now = Date.now()) {
  const { buckets } = useRateLimitStore.getState();
  const live = Object.entries(buckets).filter(([, bucket]) => bucket.slowUntil > now);
  if (live.length !== Object.keys(buckets).length)
    useRateLimitStore.setState({ buckets: Object.fromEntries(live) });
}

export function clearRateLimit() {
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();
  useRateLimitStore.setState({ buckets: {} });
}
