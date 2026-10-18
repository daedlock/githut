import { z } from "zod";
import { notificationPageKey } from "@/app/features/notifications/api";
import { getGitHubClient } from "@/app/lib/github/client";

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

/** One bounded read-only GraphQL request; no descriptions, comments or check contexts. */
export async function fetchTabStatuses(
  pages: PageEntity[],
  signal?: AbortSignal,
): Promise<{ account: string; items: TabStatus[]; failed: string[] }> {
  if (pages.length > STATUS_BATCH_SIZE) throw new Error("Invalid status batch size");
  const variables: Record<string, string | number> = {};
  const declarations: string[] = [];
  const fields = pages.map((page, index) => {
    variables[`owner${index}`] = page.owner;
    variables[`repo${index}`] = page.repo;
    variables[`number${index}`] = page.number;
    declarations.push(`$owner${index}: String!, $repo${index}: String!, $number${index}: Int!`);
    return `page${index}: repository(owner: $owner${index}, name: $repo${index}) { item: ${page.kind === "pull" ? "pullRequest" : "issue"}(number: $number${index}) { title state updatedAt timelineItems(last: 1) { updatedAt } ${page.kind === "pull" ? "isDraft statusCheckRollup { state }" : ""} } }`;
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
    | (Record<string, { item?: unknown }> & { viewer?: { id?: string } })
    | undefined;
  if (typeof data?.viewer?.id !== "string" || !data.viewer.id)
    throw new Error("Could not identify GitHub account for tab activity");
  const items: TabStatus[] = [];
  const failed: string[] = [];
  pages.forEach((page, index) => {
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
