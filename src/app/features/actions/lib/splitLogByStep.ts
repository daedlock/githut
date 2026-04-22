import type { LogLine } from "./parseLog";
import type { Step } from "../schemas";

// ─── splitLogByStep ────────────────────────────────────────────────────────
//
// GitHub's `/jobs/{id}/logs` endpoint returns ONE plaintext blob for the
// whole job. To surface per-step log segments in the UI we bucket lines
// by timestamp, since step `started_at` / `completed_at` windows line up
// reliably with each line's ISO timestamp prefix.
//
// Why not `##[group]` markers? Group titles don't map 1:1 to step names —
// setup/teardown creates extra groups, and action authors emit arbitrary
// groups inside a step. Timestamps are the only robust join.
//
// Complexity: O(N + M) via two-pointer sweep (lines + steps are both
// naturally ordered by time).

export type StepLogMap = Map<number /* step.number */, LogLine[]>;

type Window = { number: number; start: number; end: number };

export function splitLogByStep(lines: LogLine[], steps: Step[]): StepLogMap {
  // Only steps that actually ran have a window. Sort by start — we rely on
  // GitHub serialising steps (no overlapping windows in normal runs).
  const windows: Window[] = steps
    .filter((s) => !!s.started_at)
    .map((s) => ({
      number: s.number,
      // biome-ignore lint/style/noNonNullAssertion: filter guarantees started_at
      start: new Date(s.started_at!).getTime(),
      end: s.completed_at
        ? new Date(s.completed_at).getTime()
        : Number.POSITIVE_INFINITY,
    }))
    .sort((a, b) => a.start - b.start);

  const out: StepLogMap = new Map();
  for (const w of windows) out.set(w.number, []);

  if (windows.length === 0) return out;

  // Pointer walks through windows as lines advance past each step's end.
  let cursor = 0;
  for (const line of lines) {
    if (!line.timestamp) continue;
    const t = new Date(line.timestamp).getTime();
    if (!Number.isFinite(t)) continue;

    // Advance past windows whose end we've passed. `cursor < last` keeps
    // us on the last window for any trailing lines (post-job cleanup,
    // GitHub sometimes emits after the last step's completed_at).
    while (cursor < windows.length - 1 && t > (windows[cursor]?.end ?? Infinity)) {
      cursor++;
    }

    const w = windows[cursor];
    if (!w) continue;
    // Attach the line to windows[cursor]. Lines before the first step's
    // start (rare — would be job-setup output) still attach to window 0,
    // keeping the prologue visible in the first step.
    out.get(w.number)?.push(line);
  }

  return out;
}
