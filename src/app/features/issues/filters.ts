import type { ActiveFilter } from "@/app/components/ui/filter-bar";

export type IssueFilters = { state: "open" | "closed"; text: string; filters: ActiveFilter[] };
export const defaultIssueFilters: IssueFilters = { state: "open", text: "", filters: [] };
export type FilterableIssue = {
  state: string;
  title: string;
  body?: string | null;
  labels: { name: string }[];
  user: { login: string };
  assignees: { login: string }[];
};

/** Used by the visible list and its background activity signal. */
export function matchesIssue(issue: FilterableIssue, { state, text, filters }: IssueFilters) {
  if (issue.state !== state) return false;
  for (const f of filters) {
    const has =
      f.fieldId === "label"
        ? issue.labels.some((l) => l.name === f.value)
        : f.fieldId === "author"
          ? issue.user.login === f.value
          : f.fieldId === "assignee"
            ? issue.assignees.some((a) => a.login === f.value)
            : false;
    if (f.op === "is" ? !has : has) return false;
  }
  const q = text.trim().toLowerCase();
  return (
    !q ||
    issue.title.toLowerCase().includes(q) ||
    !!issue.body?.toLowerCase().includes(q) ||
    issue.user.login.toLowerCase().includes(q)
  );
}

/** Search narrows the candidate set before applying the UI's literal text match. */
export function issueActivitySearch(owner: string, repo: string, filters: IssueFilters) {
  const parts = [`repo:${owner}/${repo}`, "is:issue", `is:${filters.state}`];
  for (const f of filters.filters)
    if (["label", "author", "assignee"].includes(f.fieldId))
      parts.push(`${f.op === "is_not" ? "-" : ""}${f.fieldId}:"${f.value}"`);
  return parts.join(" ");
}
