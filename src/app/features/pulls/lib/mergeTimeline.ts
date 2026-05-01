import type { IssueCommentOnPr, Review, TimelineEvent } from "@/app/features/pulls/schemas";

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

type TimelineCommit = {
  sha: string;
  commit: { author: { date: string }; message: string };
  author: { login: string; avatar_url: string; html_url?: string } | null;
};

export type TimelineEventFeedItem = { kind: "event"; at: string } & TimelineEvent;
export type CommitGroupItem = { kind: "commitGroup"; at: string; commits: TimelineEventFeedItem[] };

export type FeedItem =
  | TimelineEventFeedItem
  | ({ kind: "comment"; at: string } & IssueCommentOnPr)
  | { kind: "review"; at: string; review: Review }
  | CommitGroupItem;

function eventKey(event: TimelineEvent): string | null {
  if (event.event === "committed") {
    const sha = event.sha ?? event.commit_id;
    return sha ? `committed:${sha}` : null;
  }
  if (event.event === "referenced" || event.event === "cross-referenced") {
    const issue = event.source?.issue;
    const ref = issue?.html_url ?? issue?.number;
    return ref ? `reference:${ref}` : null;
  }
  return event.id != null ? `${event.event}:${event.id}` : null;
}

function commitToEvent(commit: TimelineCommit): TimelineEvent {
  return {
    event: "committed",
    created_at: commit.commit.author.date,
    sha: commit.sha,
    commit_id: commit.sha,
    message: commit.commit.message,
    actor: commit.author
      ? {
          login: commit.author.login,
          avatar_url: commit.author.avatar_url,
          html_url: commit.author.html_url,
        }
      : undefined,
  };
}

export function mergeTimeline(
  events: TimelineEvent[],
  comments: IssueCommentOnPr[],
  reviews: Review[] = [],
  commits: TimelineCommit[] = [],
): FeedItem[] {
  const out: FeedItem[] = [];
  const seenEvents = new Set<string>();

  for (const e of events) {
    // "commented" → handled via /comments. "reviewed" → handled via /reviews.
    if (e.event === "commented") continue;
    if (e.event === "reviewed") continue;
    const at = e.created_at ?? e.submitted_at ?? "";
    if (!at) continue;
    const key = eventKey(e);
    if (key && seenEvents.has(key)) continue;
    if (key) seenEvents.add(key);
    out.push({ kind: "event", at, ...e });
  }

  for (const commit of commits) {
    const event = commitToEvent(commit);
    const key = eventKey(event);
    if (key && seenEvents.has(key)) continue;
    if (key) seenEvents.add(key);
    out.push({ kind: "event", at: event.created_at ?? commit.commit.author.date, ...event });
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
  return groupConsecutiveCommits(out);
}

function isCommitEvent(item: FeedItem): item is TimelineEventFeedItem {
  return item.kind === "event" && item.event === "committed";
}

function groupConsecutiveCommits(items: FeedItem[]): FeedItem[] {
  const grouped: FeedItem[] = [];
  let i = 0;

  while (i < items.length) {
    const item = items[i];
    if (!item || !isCommitEvent(item)) {
      if (item) grouped.push(item);
      i++;
      continue;
    }

    const commits: TimelineEventFeedItem[] = [];
    while (i < items.length && isCommitEvent(items[i]!)) {
      commits.push(items[i]! as TimelineEventFeedItem);
      i++;
    }

    if (commits.length === 1) {
      grouped.push(commits[0]!);
    } else {
      grouped.push({ kind: "commitGroup", at: commits[0]!.at, commits });
    }
  }

  return grouped;
}
