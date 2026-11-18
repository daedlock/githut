import { expect, test } from "bun:test";
import { breadcrumbsFor, repoSwitchHref, sectionHref } from "./breadcrumbs";
import { toInternalHref } from "./githubUrl";
import { getOpenInGithubHref } from "./openGithubUrl";
import { getTabMeta, tabRepo, tabSection } from "./tabMeta";

test("Projects is a workspace destination and repository section", () => {
  expect(getTabMeta("/projects").label).toBe("Projects");
  expect(tabRepo("/projects/users/octo/3")).toBeUndefined();
  expect(breadcrumbsFor("/projects/orgs/octo/5")).toBeNull();
  const repo = sectionHref("octo/app", "projects");
  expect(tabSection(repo)).toBe("projects");
  expect(tabRepo(repo)).toBe("octo/app");
  expect(repoSwitchHref(repo, "other/team")).toBe("/other/team/projects");
});
test("GitHub project and saved-view links round-trip to the owning workspace", () => {
  for (const kind of ["users", "orgs"]) {
    const external = `https://github.com/${kind}/octo/projects/7/views/2`;
    expect(toInternalHref(external)).toBe(`/projects/${kind}/octo/7?view=2`);
    expect(
      getOpenInGithubHref({ pathname: `/projects/${kind}/octo/7`, search: { view: "2" } }),
    ).toBe(external);
  }
  expect(toInternalHref("https://github.com/octo/app/projects")).toBe("/octo/app/projects");
});
