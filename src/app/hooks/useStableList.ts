import { useEffect, useState } from "react";

/**
 * Retain row positions (including removed rows) while updating fields for
 * surviving identities. Rows that arrive while held are appended at the end,
 * so nothing shifts under the pointer and nothing new is hidden.
 */
export function holdListOrder<T>(
  held: T[],
  incoming: T[],
  key: (item: T) => string | number,
  merge?: (held: T, current: T) => T,
): T[] {
  const latest = new Map(incoming.map((item) => [key(item), item]));
  const rows = held.map((item) => {
    const k = key(item);
    const current = latest.get(k) ?? item;
    latest.delete(k);
    return merge ? merge(item, current) : current;
  });
  return latest.size ? [...rows, ...latest.values()] : rows;
}

/** `merge` for grouped lists: hold each group's own rows. A group only ever
 * takes rows from its current version, never from the whole list. */
export function holdGroupItems<T>(key: (item: T) => string | number) {
  return <G extends { items: T[] }>(held: G, current: G): G => ({
    ...current,
    items: holdListOrder(held.items, current.items, key),
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
  // A hidden page gets no pointerleave: release the hold when the tab is
  // hidden (<Activity> runs effect cleanups) or the window is.
  useEffect(() => {
    const release = () => {
      if (document.hidden) setHeld(null);
    };
    document.addEventListener("visibilitychange", release);
    return () => {
      document.removeEventListener("visibilitychange", release);
      setHeld(null);
    };
  }, []);
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
