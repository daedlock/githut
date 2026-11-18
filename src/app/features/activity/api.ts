import { z } from "zod";
import { issueActivitySearch, matchesIssue } from "@/app/features/issues/filters";
import { notificationPageKey } from "@/app/features/notifications/api";
import { matchesPullText } from "@/app/features/pulls/search";
import { getGitHubClient } from "@/app/lib/github/client";
import type { ActivityPage } from "./pages";

export type PageEntity = {
  key: string;
  owner: string;
  repo: string;
  kind: "pull" | "issue";
  number: number;
};
export type TabStatus = {
  key: string;
  title: string;
  state: "open" | "draft" | "closed" | "merged" | "done";
  ci: "running" | "failed" | "passed" | null;
  activityAt: number;
  fingerprint?: string;
};
export const STATUS_BATCH_SIZE = 10;

export function pageEntity(href: string): PageEntity | null {
  const key = notificationPageKey(href);
  const match = /^\/([^/]+)\/([^/]+)\/(pull|issues)\/(\d+)$/.exec(key);
  if (!match) return null;
  const number = Number(match[4]);
  if (!Number.isSafeInteger(number) || number < 1) return null;
  return {
    key,
    owner: match[1]!,
    repo: match[2]!,
    kind: match[3] === "issues" ? "issue" : "pull",
    number,
  };
}

const StatusSchema = z.object({
  title: z.string(),
  state: z.enum(["OPEN", "CLOSED", "MERGED"]),
  isDraft: z.boolean().optional(),
  updatedAt: z.iso.datetime(),
  timelineItems: z.object({ updatedAt: z.iso.datetime() }),
  statusCheckRollup: z.object({ state: z.string() }).nullable().optional(),
});

/** One bounded read-only GraphQL request. Issue bodies are fetched only for literal text filtering. */
export async function fetchTabStatuses(
  pages: ActivityPage[],
  signal?: AbortSignal,
): Promise<{ account: string; items: TabStatus[]; failed: string[] }> {
  if (pages.length > STATUS_BATCH_SIZE) throw new Error("Invalid status batch size");
  const variables: Record<string, string | number> = {};
  const declarations: string[] = [];
  const fields = pages.map((page, index) => {
    if (page.kind === "inbox" || page.kind === "actions")
      throw new Error("REST/local signal in GraphQL batch");
    if (page.kind === "pulls") {
      variables[`search${index}`] = `${page.query} sort:created-desc`;
      declarations.push(`$search${index}: String!`);
      return (
        "page" +
        index +
        ": search(type: ISSUE, first: " +
        (page.text ? 100 : 1) +
        ", query: $search" +
        index +
        ") { nodes { ...on PullRequest { createdAt " +
        (page.text ? "title author { login } labels(first: 100) { nodes { name } }" : "") +
        " } } }"
      );
    }
    if (page.kind === "issues") {
      variables[`search${index}`] =
        `${issueActivitySearch(page.owner, page.repo, page.filters)} sort:created-desc`;
      declarations.push(`$search${index}: String!`);
      return `page${index}: search(type: ISSUE, first: ${page.filters.text ? 100 : 1}, query: $search${index}) { nodes { ...on Issue { createdAt ${page.filters.text ? "title body author { login }" : ""} } } }`;
    }
    variables[`owner${index}`] = page.owner;
    variables[`repo${index}`] = page.repo;
    declarations.push(`$owner${index}: String!, $repo${index}: String!`);
    const repository = `page${index}: repository(owner: $owner${index}, name: $repo${index})`;
    if (page.kind === "code") {
      if (page.ref) {
        variables[`ref${index}`] = `${page.ref}^{commit}`;
        declarations.push(`$ref${index}: String!`);
      }
      return (
        repository +
        (page.ref
          ? " { item: object(expression: $ref" +
            index +
            ") { ...on Commit { oid committedDate } } }"
          : " { item: defaultBranchRef { target { ...on Commit { oid committedDate } } } }")
      );
    }
    variables[`number${index}`] = page.number;
    declarations.push(`$number${index}: Int!`);
    return (
      repository +
      " { item: " +
      (page.kind === "pull" ? "pullRequest" : "issue") +
      "(number: $number" +
      index +
      ") { title state updatedAt timelineItems(last: 1) { updatedAt } " +
      (page.kind === "pull" ? "isDraft statusCheckRollup { state }" : "") +
      " } }"
    );
  });
  const query = `query TabStatuses${declarations.length ? `(${declarations.join(", ")})` : ""} { viewer { id } ${fields.join("\n")} }`;
  // request() preserves GraphQL's partial data alongside errors. graphql()
  // would reject the whole batch even when other repositories succeeded.
  const response = await getGitHubClient().request("POST /graphql", {
    query,
    variables,
    request: { signal },
  });
  const data = response.data?.data as
    | (Record<string, { item?: unknown; nodes?: unknown }> & { viewer?: { id?: string } })
    | undefined;
  if (typeof data?.viewer?.id !== "string" || !data.viewer.id)
    throw new Error("Could not identify GitHub account for tab activity");
  const items: TabStatus[] = [];
  const failed: string[] = [];
  pages.forEach((page, index) => {
    const rawPage = data[`page${index}`];
    if (page.kind !== "pull" && page.kind !== "issue") {
      try {
        const status = parsePageSignal(page, rawPage);
        items.push(status);
      } catch {
        failed.push(page.key);
      }
      return;
    }
    const result = StatusSchema.safeParse(data[`page${index}`]?.item);
    if (!result.success) {
      failed.push(page.key);
      return;
    }
    const raw = result.data;
    const check = raw.statusCheckRollup?.state;
    items.push({
      key: page.key,
      title: raw.title,
      state:
        raw.state === "MERGED"
          ? "merged"
          : raw.state === "CLOSED"
            ? page.kind === "issue"
              ? "done"
              : "closed"
            : raw.isDraft
              ? "draft"
              : "open",
      ci:
        check === "FAILURE" || check === "ERROR"
          ? "failed"
          : check === "PENDING" || check === "EXPECTED"
            ? "running"
            : check === "SUCCESS"
              ? "passed"
              : null,
      activityAt: Math.max(Date.parse(raw.updatedAt), Date.parse(raw.timelineItems.updatedAt)),
    });
  });
  return { account: data.viewer.id, items, failed };
}

const Created = z.object({ createdAt: z.iso.datetime() });
const Head = z.object({ oid: z.string(), committedDate: z.iso.datetime() });
const User = z.object({ login: z.string() });
const IssueSignal = Created.extend({
  title: z.string().optional(),
  body: z.string().optional(),
  author: User.nullable().optional(),
});

function parsePageSignal(page: ActivityPage, raw: unknown): TabStatus {
  const result: TabStatus = { key: page.key, title: "", state: "open", ci: null, activityAt: 0 };
  if (page.kind === "pulls") {
    const Node = Created.extend({
      title: z.string().optional(),
      author: User.nullable().optional(),
      labels: z.object({ nodes: z.array(z.object({ name: z.string() })) }).optional(),
    });
    const data = z.object({ nodes: z.array(Node) }).parse(raw);
    result.activityAt = Math.max(
      0,
      ...data.nodes
        .filter(
          (n) =>
            !page.text ||
            matchesPullText(
              { title: n.title ?? "", user: n.author, labels: n.labels?.nodes ?? [] },
              page.text,
            ),
        )
        .map((n) => Date.parse(n.createdAt)),
    );
  } else if (page.kind === "issues") {
    const data = z.object({ nodes: z.array(IssueSignal) }).parse(raw);
    result.activityAt = Math.max(
      0,
      ...data.nodes
        .filter(
          (n) =>
            !page.filters.text ||
            matchesIssue(
              {
                state: page.filters.state,
                title: n.title ?? "",
                body: n.body,
                user: n.author ?? { login: "" },
                labels: [],
                assignees: [],
              },
              { ...page.filters, filters: [] },
            ),
        )
        .map((n) => Date.parse(n.createdAt)),
    );
  } else if (page.kind === "code") {
    const data = z.object({ item: z.unknown() }).parse(raw);
    const head = page.ref
      ? Head.parse(data.item)
      : z.object({ target: Head }).parse(data.item).target;
    result.fingerprint = head.oid;
    result.activityAt = Date.parse(head.committedDate);
  } else throw new Error("Unsupported signal");
  return result;
}

/** Uses the shared authenticated ETag cache; actions are not available in GraphQL. */
export async function fetchActionSignal(
  page: Extract<ActivityPage, { kind: "actions" }>,
  signal?: AbortSignal,
): Promise<TabStatus> {
  const { owner, repo, run, params } = page;
  const response = await getGitHubClient().request(
    run
      ? "GET /repos/{owner}/{repo}/actions/runs/{run_id}"
      : params.workflow_id
        ? "GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs"
        : "GET /repos/{owner}/{repo}/actions/runs",
    {
      owner,
      repo,
      ...params,
      ...(run ? { run_id: run } : { per_page: 1, page: 1 }),
      request: { signal },
    },
  );
  const Run = z.object({
    id: z.number(),
    created_at: z.iso.datetime(),
    updated_at: z.iso.datetime(),
    status: z.string(),
    conclusion: z.string().nullable(),
    run_attempt: z.number().optional(),
  });
  const latest = run
    ? Run.parse(response.data)
    : z.object({ workflow_runs: z.array(Run) }).parse(response.data).workflow_runs[0];
  return {
    key: page.key,
    title: "",
    state: "open",
    ci: null,
    activityAt: latest ? Date.parse(run ? latest.updated_at : latest.created_at) : 0,
    ...(run && latest
      ? { fingerprint: JSON.stringify([latest.status, latest.conclusion, latest.run_attempt]) }
      : {}),
  };
}
