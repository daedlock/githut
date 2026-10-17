import { useState } from "react";

/** Retain row positions (including removed rows) while updating fields for surviving identities. */
export function holdListOrder<T>(
  held: T[],
  incoming: T[],
  key: (item: T) => string | number,
  merge?: (held: T, current: T) => T,
): T[] {
  const latest = new Map(incoming.map((item) => [key(item), item]));
  return held.map((item) => {
    const current = latest.get(key(item)) ?? item;
    return merge ? merge(item, current) : current;
  });
}

/** Queue ordering changes while pointing; `merge` preserves nested row order in grouped lists. */
export function useStableList<T>(
  incoming: T[],
  options: {
    key: (item: T) => string | number;
    resetKey?: unknown;
    merge?: (held: T, current: T) => T;
  },
) {
  const [held, setHeld] = useState<{ rows: T[]; resetKey: unknown } | null>(null);
  // A deliberate filter/sort change is not an incoming update. Refresh the
  // pointer's snapshot immediately, then hold subsequent background updates.
  if (held && held.resetKey !== options.resetKey) {
    setHeld({ rows: incoming, resetKey: options.resetKey });
  }
  return {
    items:
      held && held.resetKey === options.resetKey
        ? holdListOrder(held.rows, incoming, options.key, options.merge)
        : incoming,
    listProps: {
      onPointerEnter: () => setHeld({ rows: incoming, resetKey: options.resetKey }),
      onPointerLeave: () => setHeld(null),
      onPointerCancel: () => setHeld(null),
    },
  };
}
