export const GROUPING_FIELDS = [
  "none",
  "status",
  "assignee",
  "author",
  "label",
  "milestone",
] as const;
export type ListGrouping = (typeof GROUPING_FIELDS)[number];
export type ListKind = "issues" | "pulls";
export type GroupStatus = "open" | "draft" | "merged" | "closed";

type GroupUser = { login: string; avatar_url: string };

export type GroupableItem = {
  state: "open" | "closed";
  draft?: boolean;
  pull_request?: { merged_at?: string | null } | null;
  user: GroupUser | null;
  assignees: GroupUser[];
  labels: { name: string; color: string }[];
  milestone?: { id: number; title: string } | null;
};

export type ListGroup<T> = {
  key: string;
  label: string;
  items: T[];
  avatarUrl?: string;
  color?: string;
  status?: GroupStatus;
  missing?: boolean;
};

type GroupDescription = Omit<ListGroup<never>, "items">;

const STATUS_LABELS: Record<GroupStatus, string> = {
  open: "Open",
  draft: "Draft",
  merged: "Merged",
  closed: "Closed",
};
const STATUS_ORDER: GroupStatus[] = ["open", "draft", "merged", "closed"];

function userGroup(field: "author" | "assignee", user: GroupUser): GroupDescription {
  return {
    key: `${field}:user:${user.login.toLowerCase()}`,
    label: user.login,
    avatarUrl: user.avatar_url,
  };
}

function describeGroups(item: GroupableItem, grouping: ListGrouping): GroupDescription[] {
  switch (grouping) {
    case "none":
      return [{ key: "none", label: "All items" }];
    case "status": {
      const status: GroupStatus =
        item.state === "closed"
          ? item.pull_request?.merged_at
            ? "merged"
            : "closed"
          : item.draft
            ? "draft"
            : "open";
      return [{ key: `status:${status}`, label: STATUS_LABELS[status], status }];
    }
    case "assignee":
      return item.assignees.length
        ? item.assignees.map((user) => userGroup("assignee", user))
        : [{ key: "assignee:none", label: "Unassigned", missing: true }];
    case "author":
      return item.user
        ? [userGroup("author", item.user)]
        : [{ key: "author:none", label: "No author", missing: true }];
    case "label":
      return item.labels.length
        ? item.labels.map((label) => ({
            key: `label:name:${label.name.toLowerCase()}`,
            label: label.name,
            color: label.color,
          }))
        : [{ key: "label:none", label: "No label", missing: true }];
    case "milestone":
      return item.milestone
        ? [{ key: `milestone:${item.milestone.id}`, label: item.milestone.title }]
        : [{ key: "milestone:none", label: "No milestone", missing: true }];
  }
}

/** Keep the input's row order inside every group, including multi-value properties. */
export function groupListItems<T extends GroupableItem>(
  items: T[],
  grouping: ListGrouping,
): ListGroup<T>[] {
  const groups = new Map<string, ListGroup<T>>();
  for (const item of items) {
    const memberships = new Set<string>();
    for (const description of describeGroups(item, grouping)) {
      if (memberships.has(description.key)) continue;
      memberships.add(description.key);
      let group = groups.get(description.key);
      if (!group) {
        group = { ...description, items: [] };
        groups.set(description.key, group);
      }
      group.items.push(item);
    }
  }

  return [...groups.values()].sort((a, b) => {
    if (a.status && b.status) {
      return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
    }
    if (a.missing !== b.missing) return a.missing ? 1 : -1;
    return a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" });
  });
}
