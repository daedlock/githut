import type { Step } from "../schemas";
import type { LogLine } from "./parseLog";

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
  // Only steps that actually ran have a window. Sort by start — GitHub
  // serialises normal job steps, but we still guard invalid dates so one bad
  // timestamp from the API doesn't make every step look empty.
  const windows: Window[] = steps
    .filter((s) => !!s.started_at)
    .map((s) => {
      const start = new Date(s.started_at ?? "").getTime();
      const end = s.completed_at ? new Date(s.completed_at).getTime() : Number.POSITIVE_INFINITY;
      return {
        number: s.number,
        start,
        end: Number.isFinite(end) ? end : Number.POSITIVE_INFINITY,
      };
    })
    .filter((w) => Number.isFinite(w.start))
    .sort((a, b) => a.start - b.start);

  const out: StepLogMap = new Map();
  for (const w of windows) out.set(w.number, []);

  if (windows.length === 0) return out;

  // Pointer walks through windows as timestamped lines advance past each
  // step's end. Untimestamped continuation lines stay with the most recent
  // timestamped window instead of being dropped (important for multiline
  // stack traces and non-GitHub log sources).
  let cursor = 0;
  let sawTimestamp = false;
  for (const line of lines) {
    if (line.timestamp) {
      const t = new Date(line.timestamp).getTime();
      if (Number.isFinite(t)) {
        sawTimestamp = true;
        while (cursor < windows.length - 1 && t > (windows[cursor]?.end ?? Infinity)) {
          cursor++;
        }
      }
    } else if (!sawTimestamp && windows.length > 1) {
      // Preamble before the first timestamp belongs with the first step.
      cursor = 0;
    }

    const w = windows[cursor];
    if (!w) continue;
    out.get(w.number)?.push(line);
  }

  return out;
}
