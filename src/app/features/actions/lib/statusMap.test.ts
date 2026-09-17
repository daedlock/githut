import { describe, expect, test } from "bun:test";
import { RunConclusionSchema, RunStatusSchema } from "../schemas";
import { durationMs, isFailure, isTerminal, statusLabel, toUiStatus } from "./statusMap";

describe("Actions lifecycle", () => {
  test.each([
    "queued",
    "pending",
    "waiting",
    "requested",
    "action_required",
    "in_progress",
  ])("%s keeps polling", (status) => {
    expect(isTerminal(toUiStatus(status, null))).toBe(false);
  });
  test.each([
    "success",
    "failure",
    "timed_out",
    "startup_failure",
    "skipped",
    "cancelled",
    "neutral",
    "stale",
    "action_required",
  ])("completed %s preserves the conclusion", (conclusion) => {
    expect(toUiStatus("completed", conclusion)).toEqual({ kind: conclusion, terminal: true });
  });
  test("approval has a meaningful label without being mistaken for queued", () => {
    expect(statusLabel(toUiStatus("waiting", null))).toBe("Waiting");
    expect(statusLabel(toUiStatus("action_required", null))).toBe("Action required");
  });
  test("a stale conclusion does not override a live status", () => {
    expect(toUiStatus("in_progress", "success")).toEqual({ kind: "running", terminal: false });
  });
  test("future states and missing conclusions remain visible and do not crash parsing", () => {
    expect(RunStatusSchema.parse("future_state")).toBe("future_state");
    expect(RunConclusionSchema.parse("future_conclusion")).toBe("future_conclusion");
    expect(toUiStatus("future_state", null)).toEqual({ kind: "unknown", terminal: false });
    expect(toUiStatus("completed", null)).toEqual({ kind: "unknown", terminal: true });
  });
  test("all failure types allow retrying failed jobs", () => {
    for (const conclusion of ["failure", "timed_out", "startup_failure"])
      expect(isFailure(toUiStatus("completed", conclusion))).toBe(true);
  });
});

test("durations never keep running for terminal jobs without timestamps", () => {
  expect(durationMs("2026-09-17T10:00:00Z", null, false)).toBeNull();
  expect(durationMs(undefined, null, true)).toBeNull();
  expect(durationMs("invalid", null, true)).toBeNull();
  expect(durationMs("2026-09-17T10:00:00Z", null, true, Date.parse("2026-09-17T10:01:00Z"))).toBe(
    60_000,
  );
  expect(durationMs("2026-09-17T10:00:00Z", "2026-09-17T10:00:12Z", false)).toBe(12_000);
});
