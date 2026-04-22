import type {
  IssueCommentOnPr,
  TimelineEvent,
} from "@/app/features/pulls/schemas";

// ─── Merged-timeline feed ──────────────────────────────────────────────────
//
// GitHub's conversation view interleaves two distinct data sources:
//   1) Timeline events (assignments, label changes, review submissions,
//      etc.) from /issues/{n}/timeline
//   2) Issue comments (free-form markdown) from /issues/{n}/comments
//
// The `timeline` endpoint *does* include comment events but in an abbreviated
// form (no reactions, truncated body). Fetching comments separately gives us
// full bodies + reactions, so we merge:
//   - drop "commented" entries from the timeline (dupes with /comments)
//   - tag the rest with kind: "event"
//   - tag each /comments entry with kind: "comment"
//   - sort by timestamp ascending

export type FeedItem =
  | ({ kind: "event"; at: string } & TimelineEvent)
  | ({ kind: "comment"; at: string } & IssueCommentOnPr);

export function mergeTimeline(
  events: TimelineEvent[],
  comments: IssueCommentOnPr[],
): FeedItem[] {
  const out: FeedItem[] = [];

  for (const e of events) {
    // The "commented" event dupes rows we're going to pull from /comments.
    // Timeline also duplicates "reviewed" summary for every inline comment;
    // keep the review-level event and let the inline comment thread hang
    // off it in the UI layer.
    if (e.event === "commented") continue;
    const at = e.created_at ?? e.submitted_at ?? "";
    if (!at) continue;
    out.push({ kind: "event", at, ...e });
  }

  for (const c of comments) {
    out.push({ kind: "comment", at: c.created_at, ...c });
  }

  out.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  return out;
}
