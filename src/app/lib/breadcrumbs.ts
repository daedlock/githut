import { type RepoSection, tabRepo, tabSection } from "@/app/lib/tabMeta";
import { hrefPathname } from "@/app/workspace/model";

// ─── Breadcrumbs ───────────────────────────────────────────────────────────
//
// An island's "you are here" line, derived from its selected tab's href:
//
//   [mark] owner / repo  ›  Section  ›  #n Title
//
// Every crumb is an href, so it navigates with link semantics. This module
// is pure URL logic; BreadcrumbRow renders it.

/**
 * The crumb after the section: a PR or issue (with siblings to pick from),
 * a file open in Code, or another page inside the section (a commit, a run).
 */
export type CrumbItem =
  | { kind: "pull" | "issue"; number: number }
  | { kind: "file"; path: string }
  | { kind: "page" };

/** A PR or issue crumb: the items with siblings to pick from. */
export type NumberedItem = Extract<CrumbItem, { number: number }>;

export type Breadcrumbs = {
  /** `owner/name` */
  repo: string;
  repoHref: string;
  section: RepoSection;
  sectionHref: string;
  item: CrumbItem | null;
};

/** Parses app-relative hrefs; never a real origin. */
const BASE = "https://githut.invalid";

const SECTION_PATH: Record<RepoSection, string> = {
  code: "/code",
  commits: "/commits",
  pulls: "/pulls",
  issues: "/issues",
  actions: "/actions",
};

export function sectionHref(repo: string, section: RepoSection): string {
  return `/${repo}${SECTION_PATH[section]}`;
}

/** Crumbs for a repo page, or null for app-wide pages (Inbox, profiles). */
export function breadcrumbsFor(href: string): Breadcrumbs | null {
  const pathname = hrefPathname(href);
  const repo = tabRepo(pathname);
  const section = tabSection(pathname);
  if (!repo || !section) return null;
  return {
    repo,
    repoHref: sectionHref(repo, "code"),
    section,
    sectionHref: sectionHref(repo, section),
    item: itemOf(href, repo, section),
  };
}

const ITEM_PATH = /^(\/[^/]+\/[^/]+\/(pull|pr|review|issues)\/)(\d+)/;

function itemOf(href: string, repo: string, section: RepoSection): CrumbItem | null {
  const url = new URL(href, BASE);
  const pathname = hrefPathname(url.pathname);
  const m = ITEM_PATH.exec(pathname);
  if (m) return { kind: m[2] === "issues" ? "issue" : "pull", number: Number(m[3]) };
  const path = section === "code" && url.searchParams.get("path");
  if (path) return { kind: "file", path };
  const atSection = pathname === sectionHref(repo, section) || pathname === `/${repo}`;
  return atSection ? null : { kind: "page" };
}

/** The same section in another repo; items and file paths don't carry over. */
export function repoSwitchHref(href: string, repo: string): string {
  return sectionHref(repo, tabSection(hrefPathname(href)) ?? "code");
}

/** Another PR or issue in the same view (conversation, commits, files…). */
export function siblingItemHref(href: string, number: number): string {
  return hrefPathname(href).replace(ITEM_PATH, `$1${number}`);
}

// ─── Branch ────────────────────────────────────────────────────────────────

const BRANCH_AWARE = /^\/[^/]+\/[^/]+\/(?:code|commits|actions)$/;

/**
 * The branch a branch-aware page (Code, Commits, Actions) shows, from its
 * `branch` param; null branch means the default (Actions: all branches).
 * Null for every other page.
 */
export function branchOf(href: string): { branch: string | null } | null {
  const url = new URL(href, BASE);
  if (!BRANCH_AWARE.test(hrefPathname(url.pathname))) return null;
  return { branch: url.searchParams.get("branch") || null };
}

/** The same page on another branch; null drops back to the default. */
export function withBranch(href: string, branch: string | null): string {
  const url = new URL(href, BASE);
  if (branch) url.searchParams.set("branch", branch);
  else url.searchParams.delete("branch");
  return `${url.pathname}${url.search}${url.hash}`;
}
