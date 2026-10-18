export type PullsSort = "newest" | "oldest" | "updated" | "comments";
export type PullsState = "open" | "closed" | "all";

export type PullsFilters = {
  state?: PullsState;
  draft?: "true" | "false";
  author?: string[];
  label?: string[];
  reviewer?: string[];
  assignee?: string[];
  excludeAuthor?: string[];
  excludeLabel?: string[];
  excludeReviewer?: string[];
  excludeAssignee?: string[];
  sort?: PullsSort;
};

/**
 * Build the GitHub Search query string. `repo:{owner}/{repo} is:pr` is the
 * base; filters concatenate with spaces. Each filter value is wrapped in
 * quotes so names with spaces (labels) and special chars don't fracture
 * the query. Multi-value fields emit one qualifier per value (AND).
 */
export function buildSearchQuery(owner: string, repo: string, f: PullsFilters): string {
  const parts: string[] = [`repo:${owner}/${repo}`, "is:pr"];
  const state = f.state ?? "open";
  if (state === "open") parts.push("is:open");
  else if (state === "closed") parts.push("is:closed");
  if (f.draft === "true") parts.push("draft:true");
  else if (f.draft === "false") parts.push("draft:false");
  for (const v of f.author ?? []) parts.push(`author:${v}`);
  for (const v of f.excludeAuthor ?? []) parts.push(`-author:${v}`);
  for (const v of f.label ?? []) parts.push(`label:"${v}"`);
  for (const v of f.excludeLabel ?? []) parts.push(`-label:"${v}"`);
  for (const v of f.reviewer ?? []) parts.push(`reviewed-by:${v}`);
  for (const v of f.excludeReviewer ?? []) parts.push(`-reviewed-by:${v}`);
  for (const v of f.assignee ?? []) parts.push(`assignee:${v}`);
  for (const v of f.excludeAssignee ?? []) parts.push(`-assignee:${v}`);
  return parts.join(" ");
}

export function matchesPullText(
  pr: { title: string; user?: { login: string } | null; labels: { name: string }[] },
  text: string,
) {
  const q = text.trim().toLowerCase();
  return (
    !q ||
    pr.title.toLowerCase().includes(q) ||
    !!pr.user?.login.toLowerCase().includes(q) ||
    pr.labels.some((l) => l.name.toLowerCase().includes(q))
  );
}
