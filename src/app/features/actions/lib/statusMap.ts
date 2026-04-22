import type { RunConclusion, RunStatus } from "@/app/features/actions/schemas";

// ─── UiStatus — the UI's narrow state space ────────────────────────────────
//
// GitHub splits "status" (queued/in_progress/completed) from "conclusion"
// (success/failure/…). Every surface that renders state needs to collapse
// the two into one label. Centralising that mapping here means the UI
// layer never touches raw GitHub enums — add a case here and every pill,
// icon, dot, and timeline entry updates in lockstep.

export type UiStatus =
  | { kind: "running" }
  | { kind: "queued" }
  | { kind: "success" }
  | { kind: "failure" }
  | { kind: "cancelled" }
  | { kind: "skipped" }
  | { kind: "neutral" };

export type UiStatusKind = UiStatus["kind"];

export function toUiStatus(status: RunStatus, conclusion: RunConclusion): UiStatus {
  if (status !== "completed") {
    // pending / waiting / requested / action_required all read as "queued"
    // for display purposes — the nuance isn't actionable here.
    if (status === "in_progress") return { kind: "running" };
    return { kind: "queued" };
  }
  switch (conclusion) {
    case "success":
      return { kind: "success" };
    case "failure":
    case "timed_out":
    case "startup_failure":
      return { kind: "failure" };
    case "cancelled":
      return { kind: "cancelled" };
    case "skipped":
    case "stale":
      return { kind: "skipped" };
    case "action_required":
    case "neutral":
    case null:
      return { kind: "neutral" };
  }
}

// Stable, human-readable label. Used by aria-label and tooltip copy.
export function statusLabel(s: UiStatus): string {
  return s.kind.charAt(0).toUpperCase() + s.kind.slice(1);
}

// Is this a terminal state? Drives polling decisions.
export function isTerminal(s: UiStatus): boolean {
  return s.kind !== "running" && s.kind !== "queued";
}
