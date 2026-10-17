import { describe, expect, test } from "bun:test";
import { getDocumentTitle, getTabMeta } from "@/app/lib/tabMeta";

describe("tab metadata", () => {
  test("describes repository routes", () => {
    expect(getTabMeta("/getnickai/nickai-app/pulls")).toMatchObject({
      label: "PRs",
      sublabel: "getnickai/nickai-app",
    });
    expect(getDocumentTitle("/getnickai/nickai-app/pulls")).toBe(
      "PRs · getnickai/nickai-app · GitHut",
    );
  });

  test("describes detail and profile routes", () => {
    expect(getDocumentTitle("/getnickai/nickai-app/pull/586")).toBe(
      "PR #586 · getnickai/nickai-app · GitHut",
    );
    expect(getDocumentTitle("/daedlock")).toBe("@daedlock · GitHut");
  });

  test("describes top-level routes", () => {
    expect(getDocumentTitle("/")).toBe("Inbox · GitHut");
    expect(getDocumentTitle("/settings")).toBe("Settings · GitHut");
    expect(getDocumentTitle("/login")).toBe("Sign In · GitHut");
    expect(getDocumentTitle("/playground")).toBe("Playground · GitHut");
  });
});
