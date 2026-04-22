import type { Review, ReviewState } from "@/app/features/pulls/schemas";

// ─── Review decision aggregator ────────────────────────────────────────────
//
// GitHub shows a single "review decision" badge on a PR. It's computed
// from the LATEST review by each reviewer — not every review they've ever
// submitted. This module collapses a list of Review objects into that
// single display state + the per-reviewer latest state used by the
// Reviewers panel.

export type ReviewDecision =
  | "approved"
  | "changes_requested"
  | "review_required"
  | "commented"
  | null;

/**
 * Reduce a list of reviews to a display decision.
 *   - Any `CHANGES_REQUESTED` not superseded by a later review from the
 *     same author → "changes_requested"
 *   - Any `APPROVED` and no open "changes requested" → "approved"
 *   - Any `COMMENTED` and neither of the above → "commented"
 *   - Otherwise → `null` (no review yet)
 */
export function aggregateReviews(reviews: Review[]): ReviewDecision {
  const latestByUser = latestReviewByUser(reviews);
  const values = Array.from(latestByUser.values());
  if (values.some((s) => s === "CHANGES_REQUESTED")) return "changes_requested";
  if (values.some((s) => s === "APPROVED")) return "approved";
  if (values.some((s) => s === "COMMENTED")) return "commented";
  return null;
}

/**
 * Map each reviewer to their latest review state. PENDING and DISMISSED
 * are discarded — pending means the review hasn't been submitted yet,
 * dismissed means it's been explicitly overridden.
 */
export function latestReviewByUser(reviews: Review[]): Map<string, ReviewState> {
  const out = new Map<string, ReviewState>();
  // Reviews come back in chronological order; walk newest-last so the
  // final write wins.
  for (const r of reviews) {
    if (!r.user || r.state === "PENDING" || r.state === "DISMISSED") continue;
    out.set(r.user.login, r.state);
  }
  return out;
}
