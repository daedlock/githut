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
export type NotificationFeed = {
  items: Notification[];
  participatingIds: string[];
  pollInterval: number;
};

/** One feed for the workspace: membership comes from GitHub, not inferred reasons. */
export async function fetchNotifications(signal?: AbortSignal): Promise<NotificationFeed> {
  const client = getGitHubClient();
  const list = async (participating: boolean) => {
    const items: Notification[] = [];
    let pollInterval = 0;
    for (let page = 1; ; page++) {
      const response = await client.request("GET /notifications", {
        all: true,
        participating,
        per_page: 50,
        page,
        request: { signal },
      });
      items.push(...z.array(NotificationSchema).parse(response.data));
      const seconds = Number(response.headers["x-poll-interval"]);
      pollInterval = Math.max(
        pollInterval,
        Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 60_000,
      );
      if (!response.headers.link?.includes('rel="next"')) break;
    }
    return { items, pollInterval };
  };
  const [all, participating] = await Promise.all([list(false), list(true)]);
  // Membership can change between the two requests: retain any participating
  // thread absent from the All response rather than silently dropping it.
  const byId = new Map(all.items.map((item) => [item.id, item]));
  for (const item of participating.items) if (!byId.has(item.id)) byId.set(item.id, item);
  return {
    items: [...byId.values()],
    participatingIds: participating.items.map((item) => item.id),
    pollInterval: Math.max(all.pollInterval, participating.pollInterval),
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
