import { createContext, type ReactNode, useContext, useEffect, useState } from "react";

// ─── Wall-clock ticker ─────────────────────────────────────────────────────
//
// Durations on live runs ("Running for 2m 14s") can't get their updates from
// the data polls alone — a 3 s refetch interval means durations jump three
// seconds at a time, which reads as "stuck" between ticks. This Context
// publishes a `now` value that refreshes every second while the surrounding
// run is non-terminal, so any component calling `useNow()` re-renders in
// sync with the wall clock. Data polls handle content changes; this handles
// the cosmetic pulse between polls.

const NowContext = createContext<number | null>(null);

export function NowTicker({
  enabled,
  intervalMs = 1000,
  children,
}: {
  enabled: boolean;
  intervalMs?: number;
  children: ReactNode;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    setNow(Date.now());
    const id = setInterval(() => {
      if (!document.hidden) setNow(Date.now());
    }, intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs]);
  return <NowContext.Provider value={now}>{children}</NowContext.Provider>;
}

/**
 * Current wall-clock time in ms. Re-renders the calling component every
 * second while an enabled `NowTicker` is in the tree. Outside a ticker,
 * returns the current time at render (no subscription).
 */
export function useNow(): number {
  return useContext(NowContext) ?? Date.now();
}
