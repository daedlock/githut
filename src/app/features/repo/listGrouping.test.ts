import { describe, expect, test } from "bun:test";
import { IssueListItemSchema } from "@/app/features/issues/schemas";
import { PrListItemSchema } from "@/app/features/pulls/hooks";
import { buildPrTree } from "@/app/features/pulls/lib/buildPrTree";
import { type GroupableItem, groupListItems } from "@/app/features/repo/listGrouping";

const user = (login: string) => ({ login, avatar_url: `https://example.com/${login}.png` });
const label = (name: string) => ({ name, color: "abcdef" });
const item = (id: number, patch: Partial<GroupableItem> = {}) => ({
  id,
  state: "open" as const,
  user: user("alice"),
  labels: [],
  assignees: [],
  ...patch,
});

describe("list grouping", () => {
  test("no grouping preserves the original row order without mutating the input", () => {
    const items = [item(3), item(1), item(2)];
    expect(groupListItems(items, "none").map((group) => group.items)).toEqual([items]);
    expect(items.map((entry) => entry.id)).toEqual([3, 1, 2]);
    expect(groupListItems([], "status")).toEqual([]);
  });

  test("orders PR lifecycle states and gives closed/merged precedence over drafts", () => {
    const items = [
      item(1, { state: "closed", draft: true }),
      item(2, { draft: true }),
      item(3, { state: "closed", draft: true, pull_request: { merged_at: "2026-09-12" } }),
      item(4),
      item(5),
    ];
    expect(
      groupListItems(items, "status").map((group) => [
        group.label,
        group.items.map((row) => row.id),
      ]),
    ).toEqual([
      ["Open", [4, 5]],
      ["Draft", [2]],
      ["Merged", [3]],
      ["Closed", [1]],
    ]);
  });

  test("includes every assignee, deduplicates memberships, and puts Unassigned last", () => {
    const items = [
      item(1),
      item(2, { assignees: [user("bob"), user("alice"), user("ALICE")] }),
      item(3, { assignees: [user("alice")] }),
    ];
    const groups = groupListItems(items, "assignee");
    expect(groups.map((group) => [group.label, group.items.map((row) => row.id)])).toEqual([
      ["alice", [2, 3]],
      ["bob", [2]],
      ["Unassigned", [1]],
    ]);
    expect(groups[0]?.avatarUrl).toBe(user("alice").avatar_url);
  });

  test("places multi-label items in every label and keeps No label distinct from a real label", () => {
    const items = [
      item(1, { labels: [label("bug"), label("frontend"), label("BUG")] }),
      item(2, { labels: [label("No label")] }),
      item(3),
      item(4, { labels: [label("bug")] }),
    ];
    const groups = groupListItems(items, "label");
    expect(groups.map((group) => [group.key, group.items.map((row) => row.id)])).toEqual([
      ["label:name:bug", [1, 4]],
      ["label:name:frontend", [1]],
      ["label:name:no label", [2]],
      ["label:none", [3]],
    ]);
    expect(groups[0]?.color).toBe("abcdef");
  });

  test("handles deleted authors and case-insensitive GitHub logins", () => {
    const groups = groupListItems(
      [item(1, { user: null }), item(2, { user: user("ALICE") }), item(3)],
      "author",
    );
    expect(groups.map((group) => [group.key, group.items.length])).toEqual([
      ["author:user:alice", 2],
      ["author:none", 1],
    ]);
  });

  test("sorts milestones naturally and keeps their identity when titles change", () => {
    const groups = groupListItems(
      [
        item(1, { milestone: { id: 10, title: "Release 10" } }),
        item(2),
        item(3, { milestone: { id: 2, title: "Release 2" } }),
      ],
      "milestone",
    );
    expect(groups.map((group) => group.key)).toEqual([
      "milestone:2",
      "milestone:10",
      "milestone:none",
    ]);
    const renamed = groupListItems(
      [item(3, { milestone: { id: 2, title: "Launch" } })],
      "milestone",
    );
    expect(renamed[0]?.key).toBe(groups[0]?.key);
  });

  test("recomputes counts after search and pagination without changing group keys", () => {
    const firstPage = [item(1, { labels: [label("bug")] }), item(2)];
    const nextPage = [item(3, { labels: [label("bug"), label("frontend")] })];
    const before = groupListItems(firstPage, "label")[0]!;
    const after = groupListItems([...firstPage, ...nextPage], "label")[0]!;
    expect(before.key).toBe(after.key);
    expect(after.items.length).toBe(2);
    expect(
      groupListItems(
        after.items.filter((entry) => entry.id === 3),
        "label",
      )[0]?.items.length,
    ).toBe(1);
  });
});

const rawItem = {
  id: 1,
  number: 1,
  title: "An item",
  state: "open",
  html_url: "https://github.com/acme/console/pull/1",
  user: user("alice"),
  comments: 0,
  created_at: "2026-09-12T00:00:00Z",
  updated_at: "2026-09-12T00:00:00Z",
  closed_at: null,
  body: "",
  labels: [],
  milestone: { id: 1, title: "Launch" },
};

test("issue and PR list schemas retain milestone data and accept missing milestones", () => {
  for (const schema of [IssueListItemSchema, PrListItemSchema]) {
    expect(schema.parse(rawItem).milestone).toEqual(rawItem.milestone);
    expect(schema.parse({ ...rawItem, milestone: null }).milestone).toBeNull();
    expect(schema.parse({ ...rawItem, milestone: undefined }).milestone).toBeUndefined();
  }
});

test("stacked PRs nest only inside their matching group without losing cross-group children", () => {
  const pulls = [
    PrListItemSchema.parse({ ...rawItem, id: 3, number: 3, user: user("bob") }),
    PrListItemSchema.parse({ ...rawItem, id: 2, number: 2 }),
    PrListItemSchema.parse(rawItem),
  ];
  const refs = new Map([
    [1, { headRefName: "base-feature", baseRefName: "main" }],
    [2, { headRefName: "child-feature", baseRefName: "base-feature" }],
    [3, { headRefName: "last-feature", baseRefName: "child-feature" }],
  ]);
  const groups = groupListItems(pulls, "author");
  const trees = groups.map((group) => buildPrTree(group.items, refs, "main"));
  expect(trees.map((tree) => tree.map((node) => [node.pr.number, node.depth]))).toEqual([
    [
      [1, 0],
      [2, 1],
    ],
    [[3, 0]],
  ]);
  expect(buildPrTree(pulls, refs, "main").map((node) => [node.pr.number, node.depth])).toEqual([
    [1, 0],
    [2, 1],
    [3, 2],
  ]);
});
