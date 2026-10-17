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

export type CrumbItem = { kind: "pull" | "issue"; number: number };

export type Breadcrumbs = {
  /** `owner/name` */
  repo: string;
  repoHref: string;
  section: RepoSection;
  sectionHref: string;
  item: CrumbItem | null;
};

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
    item: itemOf(pathname),
  };
}

function itemOf(pathname: string): CrumbItem | null {
  const m = /^\/[^/]+\/[^/]+\/(pull|pr|review|issues)\/(\d+)/.exec(pathname);
  if (!m) return null;
  return { kind: m[1] === "issues" ? "issue" : "pull", number: Number(m[2]) };
}

/** The same section in another repo; items and file paths don't carry over. */
export function repoSwitchHref(href: string, repo: string): string {
  return sectionHref(repo, tabSection(hrefPathname(href)) ?? "code");
}

/** Another PR or issue in the same view (conversation, commits, files…). */
export function siblingItemHref(href: string, number: number): string {
  return hrefPathname(href).replace(
    /^(\/[^/]+\/[^/]+\/(?:pull|pr|review|issues)\/)\d+/,
    `$1${number}`,
  );
}

// ─── Branch ────────────────────────────────────────────────────────────────

const BRANCH_AWARE = /^\/[^/]+\/[^/]+\/(?:code|commits|actions)$/;

/**
 * The branch a branch-aware page (Code, Commits, Actions) shows, from its
 * `branch` param; null branch means the default (Actions: all branches).
 * Null for every other page.
 */
export function branchOf(href: string): { branch: string | null } | null {
  const url = new URL(href, "https://githut.invalid");
  if (!BRANCH_AWARE.test(hrefPathname(url.pathname))) return null;
  return { branch: url.searchParams.get("branch") || null };
}

/** The same page on another branch; null drops back to the default. */
export function withBranch(href: string, branch: string | null): string {
  const url = new URL(href, "https://githut.invalid");
  if (branch) url.searchParams.set("branch", branch);
  else url.searchParams.delete("branch");
  return `${url.pathname}${url.search}${url.hash}`;
}
