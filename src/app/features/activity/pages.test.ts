import { afterEach, expect, test } from "bun:test";
import { activityPage, useIssueActivityFilters } from "./pages";

afterEach(() => useIssueActivityFilters.setState({ tabs: {} }));
test("PR scope preserves all filters and ignores sorting; code scope preserves case-sensitive branch", () => {
  const page = activityPage(
    "/Demo/Repo/pulls?label=%5B%22bug%22,%22help%20wanted%22%5D&excludeAuthor=bot&reviewer=alice&draft=true&sort=comments",
  );
  expect(page?.kind).toBe("pulls");
  if (page?.kind !== "pulls") throw Error("wrong scope");
  expect(page.query).toBe(
    'repo:demo/repo is:pr is:open draft:true -author:bot label:"bug" label:"help wanted" reviewed-by:alice',
  );
  expect(
    activityPage(
      "/Demo/Repo/pulls?label=%5B%22help%20wanted%22,%22bug%22%5D&excludeAuthor=bot&reviewer=alice&draft=true",
    )?.key,
  ).toBe(page.key);
  expect(activityPage("/demo/repo/commits?branch=Feature%2FOne")?.key).toBe(
    activityPage("/demo/repo/code?branch=Feature%2FOne&path=src")?.key,
  );
  expect(activityPage("/demo/repo/code?branch=feature%2Fone")?.key).not.toBe(
    activityPage("/demo/repo/code?branch=Feature%2FOne")?.key,
  );
});
test("local issue filter identities stay independent between duplicate tabs", () => {
  useIssueActivityFilters.setState({
    tabs: {
      a: {
        state: "closed",
        text: "needle",
        filters: [{ fieldId: "label", op: "is_not", value: "bug" }],
      },
    },
  });
  expect(activityPage("/demo/repo/issues", "a")?.key).not.toBe(
    activityPage("/demo/repo/issues", "b")?.key,
  );
  expect(activityPage("/?view=work")).toBeNull();
  expect(activityPage("/?view=all")?.key).not.toBe(activityPage("/")?.key);
});

import { defaultStringifySearch } from "@tanstack/react-router";

test("router-generated strings retain draft filters and numeric branches", () => {
  const page = activityPage(
    `/o/r/pulls${defaultStringifySearch({ draft: "true", label: ["bug"] })}`,
  );
  expect(page?.kind === "pulls" && page.query).toContain("draft:true");
  const code = activityPage(`/o/r/code${defaultStringifySearch({ branch: "123" })}`);
  expect(code?.kind === "code" && code.ref).toBe("123");
});

test("local PR text scopes duplicate tabs independently", () => {
  useIssueActivityFilters.setState({ pullText: { a: "Security" } });
  const a = activityPage("/o/r/pulls", "a"),
    b = activityPage("/o/r/pulls", "b");
  expect(a?.key).not.toBe(b?.key);
  expect(a?.kind === "pulls" && a.text).toBe("security");
  useIssueActivityFilters.setState({ pullText: {} });
});
