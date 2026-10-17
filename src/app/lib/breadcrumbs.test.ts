import { describe, expect, test } from "bun:test";
import {
  branchOf,
  breadcrumbsFor,
  repoSwitchHref,
  siblingItemHref,
  withBranch,
} from "@/app/lib/breadcrumbs";

describe("breadcrumbs", () => {
  test("a pull request reads repo › Pull requests › #n", () => {
    expect(breadcrumbsFor("/daedlock/githut/pull/22")).toEqual({
      repo: "daedlock/githut",
      repoHref: "/daedlock/githut/code",
      section: "pulls",
      sectionHref: "/daedlock/githut/pulls",
      item: { kind: "pull", number: 22 },
    });
  });

  test("a section page ends at the section; app-wide pages have no trail", () => {
    expect(breadcrumbsFor("/daedlock/githut/commits?branch=dev")).toMatchObject({
      section: "commits",
      sectionHref: "/daedlock/githut/commits",
      item: null,
    });
    expect(breadcrumbsFor("/")).toBeNull();
    expect(breadcrumbsFor("/daedlock")).toBeNull();
  });

  test("issues and a PR's files view are items of their sections", () => {
    expect(breadcrumbsFor("/daedlock/githut/issues/24")).toMatchObject({
      section: "issues",
      item: { kind: "issue", number: 24 },
    });
    expect(breadcrumbsFor("/daedlock/githut/pr/22/code")).toMatchObject({
      section: "pulls",
      item: { kind: "pull", number: 22 },
    });
  });

  test("switching repo keeps the section, not the item", () => {
    expect(repoSwitchHref("/daedlock/githut/pull/22", "getnickai/nickai-app")).toBe(
      "/getnickai/nickai-app/pulls",
    );
    expect(repoSwitchHref("/daedlock/githut/code?path=src/a.ts", "daedlock/dotfiles")).toBe(
      "/daedlock/dotfiles/code",
    );
  });

  test("a sibling PR or issue keeps the view you are on", () => {
    expect(siblingItemHref("/daedlock/githut/pull/22/commits?x=1#c", 19)).toBe(
      "/daedlock/githut/pull/19/commits",
    );
    expect(siblingItemHref("/daedlock/githut/issues/24", 23)).toBe("/daedlock/githut/issues/23");
  });

  test("only Code, Commits and Actions lists are branch-aware", () => {
    expect(branchOf("/daedlock/githut/code?path=src&branch=dev")).toEqual({ branch: "dev" });
    expect(branchOf("/daedlock/githut/commits")).toEqual({ branch: null });
    expect(branchOf("/daedlock/githut/actions?status=failure")).toEqual({ branch: null });
    expect(branchOf("/daedlock/githut/actions/runs/4182")).toBeNull();
    expect(branchOf("/daedlock/githut/pull/22")).toBeNull();
    expect(branchOf("/")).toBeNull();
  });

  test("switching branch keeps the page's other state", () => {
    expect(withBranch("/daedlock/githut/code?path=src/app#L3", "dev")).toBe(
      "/daedlock/githut/code?path=src%2Fapp&branch=dev#L3",
    );
    expect(withBranch("/daedlock/githut/commits?branch=dev", null)).toBe(
      "/daedlock/githut/commits",
    );
  });
});
