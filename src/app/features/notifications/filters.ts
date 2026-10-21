import type { ActiveFilter } from "@/app/components/ui/filter-bar";
import { type Notification, notificationHref, notificationPageKey } from "./api";

/**
 * Inbox filters, kept in the route search so each tab holds its own:
 * `?repo=a/b,-c/d&type=PullRequest&who=mine`. List values are comma-joined;
 * a leading `-` means "is not" (owners and subject types never start with one).
 */
export type InboxSearch = { repo?: string; type?: string; who?: InboxWho };
export type InboxWho = "mine" | "team";
export type InboxFieldId = "repo" | "type" | "who";

const LIST_FIELDS = ["repo", "type"] as const;

export function searchToActive(search: InboxSearch): ActiveFilter[] {
  const out: ActiveFilter[] = [];
  for (const fieldId of LIST_FIELDS) {
    for (const raw of search[fieldId]?.split(",") ?? []) {
      if (!raw || raw === "-") continue;
      const negated = raw.startsWith("-");
      out.push({ fieldId, op: negated ? "is_not" : "is", value: negated ? raw.slice(1) : raw });
    }
  }
  if (search.who) out.push({ fieldId: "who", op: "is", value: search.who });
  return out;
}

/** Every key is set, so spreading the patch over the old search clears removed filters. */
export function activeToSearch(active: ActiveFilter[]): {
  repo: string | undefined;
  type: string | undefined;
  who: InboxWho | undefined;
} {
  const lists: Record<(typeof LIST_FIELDS)[number], string[]> = { repo: [], type: [] };
  let who: InboxWho | undefined;
  for (const filter of active) {
    if (filter.fieldId === "who") {
      // Single choice: the latest pick wins.
      if (filter.value === "mine" || filter.value === "team") who = filter.value;
      continue;
    }
    const list = lists[filter.fieldId as (typeof LIST_FIELDS)[number]];
    if (!list) continue;
    const token = filter.op === "is_not" ? `-${filter.value}` : filter.value;
    if (!list.includes(token)) list.push(token);
  }
  return {
    repo: lists.repo.join(",") || undefined,
    type: lists.type.join(",") || undefined,
    who,
  };
}

/**
 * Builds the row predicate. Within a field, "is" values OR together and any
 * "is not" value excludes; fields AND together.
 *
 * "Mine" is a thread you authored. GitHub's `reason` reports only the latest
 * reason (a mention on your own PR says `mention`), so `mine` also takes the
 * page keys of your open authored PRs from Your work.
 */
export function inboxFilter(
  active: ActiveFilter[],
  mine: ReadonlySet<string> = new Set(),
): (item: Notification) => boolean {
  if (!active.length) return () => true;
  const rules = new Map<string, { is: Set<string>; not: Set<string> }>();
  for (const filter of active) {
    const rule = rules.get(filter.fieldId) ?? { is: new Set(), not: new Set() };
    // Repo names are case-insensitive on GitHub.
    const value = filter.fieldId === "repo" ? filter.value.toLowerCase() : filter.value;
    (filter.op === "is_not" ? rule.not : rule.is).add(value);
    rules.set(filter.fieldId, rule);
  }
  const passes = (fieldId: InboxFieldId, value: string) => {
    const rule = rules.get(fieldId);
    if (!rule) return true;
    if (rule.not.has(value)) return false;
    return rule.is.size === 0 || rule.is.has(value);
  };
  return (item) =>
    passes("repo", item.repository.full_name.toLowerCase()) &&
    passes("type", item.subject.type) &&
    passes("who", isMine(item, mine) ? "mine" : "team");
}

export function isMine(item: Notification, mine: ReadonlySet<string>): boolean {
  if (item.reason === "author") return true;
  const href = notificationHref(item);
  return !!href && mine.has(notificationPageKey(href));
}

/** Repos in the feed, loudest first: unread count, then total, then name. */
export function feedRepos(
  items: Notification[],
  isUnread: (item: Notification) => boolean,
): Array<{ repo: string; unread: number; total: number }> {
  const byRepo = new Map<string, { repo: string; unread: number; total: number }>();
  for (const item of items) {
    const repo = item.repository.full_name;
    const entry = byRepo.get(repo) ?? { repo, unread: 0, total: 0 };
    entry.total++;
    if (isUnread(item)) entry.unread++;
    byRepo.set(repo, entry);
  }
  return [...byRepo.values()].sort(
    (a, b) => b.unread - a.unread || b.total - a.total || a.repo.localeCompare(b.repo),
  );
}
