import { z } from "zod";
import { getGitHubClient } from "@/app/lib/github/client";

const NotificationSchema = z.object({
  id: z.string(),
  unread: z.boolean(),
  reason: z.string(),
  updated_at: z.string(),
  last_read_at: z.string().nullable(),
  subject: z.object({
    title: z.string(),
    type: z.string(),
    url: z.string().nullable(),
    latest_comment_url: z.string().nullable().optional(),
  }),
  repository: z.object({ full_name: z.string(), html_url: z.string() }),
});
export type Notification = z.infer<typeof NotificationSchema>;
export type NotificationPage = {
  items: Notification[];
  hasMore: boolean;
  pollInterval: number;
};
export type NotificationFeed = {
  items: Notification[];
  /** Pages loaded so far. Polling refreshes only the first; older ones load on request. */
  pages: number;
  hasMore: boolean;
  pollInterval: number;
};

export const NOTIFICATIONS_PER_PAGE = 50;

/**
 * Reasons GitHub counts as "participating": you were involved directly, not
 * through a watch, a team or CI. Deriving this from `reason` keeps a poll to
 * one request instead of a second `participating=true` listing.
 */
const PARTICIPATING_REASONS = new Set([
  "approval_requested",
  "assign",
  "author",
  "comment",
  "invitation",
  "manual",
  "member_feature_requested",
  "mention",
  "review_requested",
  "security_advisory_credit",
  "state_change",
]);

export function isParticipating(item: Notification): boolean {
  return PARTICIPATING_REASONS.has(item.reason);
}

/**
 * One page of the Inbox, read threads included. Page 1 is what polling asks
 * for; the client sends it conditionally (If-None-Match / If-Modified-Since),
 * so an unchanged Inbox costs one free 304.
 */
export async function fetchNotificationPage(
  page: number,
  signal?: AbortSignal,
): Promise<NotificationPage> {
  const response = await getGitHubClient().request("GET /notifications", {
    all: true,
    per_page: NOTIFICATIONS_PER_PAGE,
    page,
    request: { signal },
  });
  const seconds = Number(response.headers["x-poll-interval"]);
  return {
    items: z.array(NotificationSchema).parse(response.data),
    hasMore: !!response.headers.link?.includes('rel="next"'),
    pollInterval: Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 60_000,
  };
}

/**
 * Fold a fresh first page into what's loaded. Older pages stay, minus any
 * thread the new page now holds; threads newer than the page's oldest row
 * but missing from it were removed (Done elsewhere), so they go too.
 */
export function mergeFirstPage(
  first: NotificationPage,
  previous?: NotificationFeed,
): NotificationFeed {
  const fresh = { ...first, pages: 1 };
  if (!previous || previous.pages <= 1 || !first.hasMore) return fresh;
  const ids = new Set(first.items.map((item) => item.id));
  const oldest = first.items.at(-1)?.updated_at ?? "";
  const tail = previous.items.filter((item) => !ids.has(item.id) && item.updated_at <= oldest);
  return {
    items: [...first.items, ...tail],
    pages: previous.pages,
    hasMore: previous.hasMore,
    pollInterval: first.pollInterval,
  };
}

/** Append the next page; threads shift between pages as they update, so dedupe. */
export function appendPage(feed: NotificationFeed, next: NotificationPage): NotificationFeed {
  const ids = new Set(feed.items.map((item) => item.id));
  return {
    ...feed,
    items: [...feed.items, ...next.items.filter((item) => !ids.has(item.id))],
    pages: feed.pages + 1,
    hasMore: next.hasMore,
  };
}

/** Only supported app routes are internal; all other subjects stay on GitHub. */
export function notificationHref(item: Notification): string | null {
  if (!item.subject.url) return null;
  let url: URL;
  try {
    url = new URL(item.subject.url);
  } catch {
    return null;
  }
  if (url.origin !== "https://api.github.com") return null;
  const match = /^\/repos\/([^/]+)\/([^/]+)\/(issues|pulls|commits)\/([^/]+)$/.exec(url.pathname);
  if (!match) return null;
  const [, owner, repo, kind, id] = match;
  return `/${owner}/${repo}/${kind === "pulls" ? "pull" : kind === "commits" ? "commit" : "issues"}/${id}`;
}

export function notificationGitHubHref(item: Notification): string {
  const href = notificationHref(item);
  if (href) return `https://github.com${href}`;
  // The filtered GitHub Inbox can open notification kinds this client cannot render.
  return `https://github.com/notifications?query=${encodeURIComponent(`repo:${item.repository.full_name}`)}`;
}

export function notificationPageKey(href: string): string {
  const pathname = href.split(/[?#]/)[0] ?? href;
  return pathname
    .replace(/\/(pr|review)\/(\d+)(?:\/.*)?$/, "/pull/$2")
    .replace(/\/(pull|issues)\/(\d+)(?:\/.*)?$/, "/$1/$2")
    .toLowerCase();
}
