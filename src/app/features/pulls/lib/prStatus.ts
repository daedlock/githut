import type { PullRequest } from "@/app/features/pulls/schemas";

// ─── UiState — the narrow state the UI renders ─────────────────────────────
//
// GitHub's REST `state` field only goes "open" / "closed". But the user
// sees four distinct states: open, draft (open + draft), merged (closed +
// merged), closed (closed + !merged). Every surface that paints a pill
// should call `toUiState(pr)` to get the right flavor in one shot.

export type PrUiState = "open" | "draft" | "merged" | "closed";

export function toUiState(pr: Pick<PullRequest, "state" | "draft" | "merged">): PrUiState {
  if (pr.state === "closed") return pr.merged ? "merged" : "closed";
  return pr.draft ? "draft" : "open";
}

/** Human-readable label for a given UI state — used in aria + tooltips. */
export function stateLabel(s: PrUiState): string {
  switch (s) {
    case "open":
      return "Open";
    case "draft":
      return "Draft";
    case "merged":
      return "Merged";
    case "closed":
      return "Closed";
  }
}

/** Is this PR in a "live" (still mutable by normal actions) state? */
export function isLive(s: PrUiState): boolean {
  return s === "open" || s === "draft";
}
