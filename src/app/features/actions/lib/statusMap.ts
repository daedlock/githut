import type { RunConclusion, RunStatus } from "../schemas";

export type UiStatusKind =
  | "running"
  | "queued"
  | "waiting"
  | "pending"
  | "action_required"
  | "success"
  | "failure"
  | "timed_out"
  | "cancelled"
  | "skipped"
  | "neutral"
  | "stale"
  | "startup_failure"
  | "unknown";
export type UiStatus = { kind: UiStatusKind; terminal: boolean };

const LABELS: Record<UiStatusKind, string> = {
  running: "In progress",
  queued: "Queued",
  waiting: "Waiting",
  pending: "Pending",
  action_required: "Action required",
  success: "Success",
  failure: "Failure",
  timed_out: "Timed out",
  cancelled: "Cancelled",
  skipped: "Skipped",
  neutral: "Neutral",
  stale: "Stale",
  startup_failure: "Startup failure",
  unknown: "Unknown",
};

// Conclusions describe results only after completion. Waiting for approval
// must keep polling; a completed run without a result must never look green.
export function toUiStatus(status: RunStatus, conclusion: RunConclusion): UiStatus {
  if (status !== "completed") {
    const kind =
      status === "in_progress"
        ? "running"
        : status === "requested"
          ? "queued"
          : ["queued", "waiting", "pending", "action_required"].includes(status)
            ? (status as UiStatusKind)
            : "unknown";
    return { kind, terminal: false };
  }
  const kind =
    conclusion && Object.hasOwn(LABELS, conclusion) ? (conclusion as UiStatusKind) : "unknown";
  return { kind, terminal: true };
}

export function statusLabel(s: UiStatus): string {
  return LABELS[s.kind];
}
export function isTerminal(s: UiStatus): boolean {
  return s.terminal;
}

export function isFailure(s: UiStatus): boolean {
  return ["failure", "timed_out", "startup_failure"].includes(s.kind);
}

export function durationMs(
  start: string | null | undefined,
  end: string | null | undefined,
  live: boolean,
  now = Date.now(),
): number | null {
  if (!start || (!end && !live)) return null;
  const from = Date.parse(start);
  const to = end ? Date.parse(end) : now;
  return Number.isFinite(from) && Number.isFinite(to) ? Math.max(0, to - from) : null;
}
