import { expect, test } from "bun:test";
import type { Notification } from "./api";
import { activeToSearch, feedRepos, inboxFilter, isMine, searchToActive } from "./filters";

const thread = (
  id: string,
  repo: string,
  type: "PullRequest" | "Issue" | "Release",
  reason = "mention",
  unread = true,
): Notification => ({
  id,
  unread,
  reason,
  updated_at: "2026-10-17T10:00:00Z",
  last_read_at: null,
  subject: {
    title: `Thread ${id}`,
    type,
    url: `https://api.github.com/repos/${repo}/${type === "Issue" ? "issues" : "pulls"}/${id}`,
    latest_comment_url: null,
  },
  repository: { full_name: repo, html_url: `https://github.com/${repo}` },
});

const feed = [
  thread("1", "acme/api", "PullRequest", "author"),
  thread("2", "acme/api", "Issue", "assign"),
  thread("3", "acme/web", "PullRequest", "review_requested"),
  thread("4", "acme/web", "PullRequest", "mention"),
  thread("5", "other/lib", "Issue", "mention", false),
];
const ids = (rows: Notification[]) => rows.map((item) => item.id);

test("search round-trips through active filters, with - meaning is not", () => {
  const search = { repo: "acme/api,-other/lib", type: "PullRequest", who: "team" as const };
  const active = searchToActive(search);
  expect(active).toEqual([
    { fieldId: "repo", op: "is", value: "acme/api" },
    { fieldId: "repo", op: "is_not", value: "other/lib" },
    { fieldId: "type", op: "is", value: "PullRequest" },
    { fieldId: "who", op: "is", value: "team" },
  ]);
  expect(activeToSearch(active)).toEqual(search);
});

test("removing every filter clears every search key", () => {
  expect(activeToSearch([])).toEqual({ repo: undefined, type: undefined, who: undefined });
});

test("several repos OR together; is-not excludes; repo match ignores case", () => {
  const two = searchToActive({ repo: "acme/api,ACME/Web" });
  expect(ids(feed.filter(inboxFilter(two)))).toEqual(["1", "2", "3", "4"]);
  const not = searchToActive({ repo: "-acme/web" });
  expect(ids(feed.filter(inboxFilter(not)))).toEqual(["1", "2", "5"]);
});

test("fields AND together: teammates' PRs in one repo", () => {
  const active = searchToActive({ repo: "acme/web", type: "PullRequest", who: "team" });
  expect(ids(feed.filter(inboxFilter(active)))).toEqual(["3", "4"]);
});

test("mine is reason author or one of your authored PRs; team is everything else", () => {
  const mine = new Set(["/acme/web/pull/4"]);
  expect(isMine(feed[0]!, mine)).toBe(true);
  expect(isMine(feed[3]!, mine)).toBe(true);
  expect(ids(feed.filter(inboxFilter(searchToActive({ who: "mine" }), mine)))).toEqual(["1", "4"]);
  expect(ids(feed.filter(inboxFilter(searchToActive({ who: "team" }), mine)))).toEqual([
    "2",
    "3",
    "5",
  ]);
});

test("a single-choice who keeps the latest pick", () => {
  const search = activeToSearch([
    { fieldId: "who", op: "is", value: "mine" },
    { fieldId: "who", op: "is", value: "team" },
  ]);
  expect(search.who).toBe("team");
});

test("feed repos sort by unread, then total, then name", () => {
  expect(feedRepos(feed, (item) => item.unread)).toEqual([
    { repo: "acme/api", unread: 2, total: 2 },
    { repo: "acme/web", unread: 2, total: 2 },
    { repo: "other/lib", unread: 0, total: 1 },
  ]);
});
