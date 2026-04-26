import type {
  IssueCommentOnPr,
  Review,
  TimelineEvent,
} from "@/app/features/pulls/schemas";

// ─── Merged-timeline feed ──────────────────────────────────────────────────
//
// GitHub's conversation view interleaves three data sources:
//   1) Timeline events (assignments, label changes, refs, etc.) from
//      /issues/{n}/timeline
//   2) Issue comments (free-form markdown) from /issues/{n}/comments
//   3) Reviews (approve / request-changes / commented) from
//      /pulls/{n}/reviews — fetched separately because the timeline's
//      "reviewed" event uses event-level ids that don't always match the
//      review's own id, and PENDING reviews never surface in the timeline.
//
// We drop "commented" and "reviewed" entries from the timeline (they're
// duplicates of /comments and /reviews respectively) and inject the
// authoritative records from those endpoints instead.

export type FeedItem =
  | ({ kind: "event"; at: string } & TimelineEvent)
  | ({ kind: "comment"; at: string } & IssueCommentOnPr)
  | { kind: "review"; at: string; review: Review };

export function mergeTimeline(
  events: TimelineEvent[],
  comments: IssueCommentOnPr[],
  reviews: Review[] = [],
): FeedItem[] {
  const out: FeedItem[] = [];

  for (const e of events) {
    // "commented" → handled via /comments. "reviewed" → handled via /reviews.
    if (e.event === "commented") continue;
    if (e.event === "reviewed") continue;
    const at = e.created_at ?? e.submitted_at ?? "";
    if (!at) continue;
    out.push({ kind: "event", at, ...e });
  }

  for (const c of comments) {
    out.push({ kind: "comment", at: c.created_at, ...c });
  }

  for (const r of reviews) {
    // Skip pending drafts (only visible to author until submitted).
    if (r.state === "PENDING") continue;
    const at = r.submitted_at ?? "";
    if (!at) continue;
    out.push({ kind: "review", at, review: r });
  }

  out.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  return out;
}
