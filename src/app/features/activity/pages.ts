import { defaultParseSearch } from "@tanstack/react-router";
import { useLayoutEffect } from "react";
import { create } from "zustand";
import { defaultIssueFilters, type IssueFilters } from "@/app/features/issues/filters";
import { buildSearchQuery, type PullsFilters } from "@/app/features/pulls/search";
import { useTabScope } from "@/app/lib/tabScope";
import { type PageEntity, pageEntity } from "./api";

// Local issue filters belong to a kept-alive tab. Retain them on Activity
// teardown; the watcher prunes entries when tabs actually close.
export const useIssueActivityFilters = create<{
  tabs: Record<string, IssueFilters>;
  pullText: Record<string, string>;
}>(() => ({ tabs: {}, pullText: {} }));
export function useIssueActivityFilter(
  state: IssueFilters["state"],
  text: string,
  filters: IssueFilters["filters"],
) {
  const { tabId } = useTabScope();
  useLayoutEffect(() => {
    if (tabId)
      useIssueActivityFilters.setState((s) => ({
        tabs: { ...s.tabs, [tabId]: { state, text, filters } },
      }));
  }, [tabId, state, text, filters]);
}

type RepoPage = { key: string; owner: string; repo: string };
export type ActivityPage =
  | PageEntity
  | (RepoPage & { kind: "pulls"; query: string; text: string })
  | (RepoPage & { kind: "issues"; filters: IssueFilters })
  | (RepoPage & { kind: "code"; ref?: string })
  | (RepoPage & { kind: "actions"; run?: number; params: Record<string, string | number> })
  | { kind: "inbox"; key: string; all: boolean };

function strings(params: URLSearchParams, key: string): string[] | undefined {
  const values = params.getAll(key);
  if (!values.length) return undefined;
  return values
    .flatMap((value) => {
      try {
        const parsed: unknown = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === "string");
      } catch {
        /* ordinary URL string */
      }
      return [value];
    })
    .sort();
}

/** Identity includes the actual filter/branch scope; ordering alone doesn't create new activity. */
export function activityPage(href: string, tabId?: string): ActivityPage | null {
  const entity = pageEntity(href);
  if (entity) return entity;
  const url = new URL(href, "https://githut.local");
  const path = url.pathname.replace(/\/$/, "");
  // TanStack JSON-escapes strings such as "true" and numeric branch names.
  // Decode with the same parser as the actual page before reading filters.
  const parsed = defaultParseSearch(url.search);
  const p = new URLSearchParams();
  for (const [key, value] of Object.entries(parsed))
    p.set(key, Array.isArray(value) ? JSON.stringify(value) : String(value));
  if (!path)
    return p.get("view") === "work"
      ? null
      : {
          kind: "inbox",
          key: p.get("view") === "all" ? "/?view=all" : "/",
          all: p.get("view") === "all",
        };
  const match = /^\/([^/]+)\/([^/]+)\/(pulls|issues|code|commits|actions)(?:\/runs\/(\d+))?$/.exec(
    path,
  );
  if (!match) return null;
  const owner = match[1]!.toLowerCase(),
    repo = match[2]!.toLowerCase();
  const base = { owner, repo },
    prefix = `/${owner}/${repo}`;
  if (match[3] === "pulls") {
    const filters: PullsFilters = {
      state: p.get("state") === "all" ? "all" : p.get("state") === "closed" ? "closed" : "open",
      draft: p.get("draft") === "true" ? "true" : p.get("draft") === "false" ? "false" : undefined,
    };
    for (const field of [
      "author",
      "label",
      "reviewer",
      "assignee",
      "excludeAuthor",
      "excludeLabel",
      "excludeReviewer",
      "excludeAssignee",
    ] as const)
      filters[field] = strings(p, field);
    const query = buildSearchQuery(owner, repo, filters);
    const text = ((tabId && useIssueActivityFilters.getState().pullText[tabId]) || "")
      .trim()
      .toLowerCase();
    return {
      ...base,
      kind: "pulls",
      key: `${prefix}/pulls?${JSON.stringify([query, text])}`,
      query,
      text,
    };
  }
  if (match[3] === "issues") {
    const raw = (tabId && useIssueActivityFilters.getState().tabs[tabId]) || defaultIssueFilters;
    const filters = {
      ...raw,
      text: raw.text.trim().toLowerCase(),
      filters: [...raw.filters].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    };
    return { ...base, kind: "issues", key: `${prefix}/issues?${JSON.stringify(filters)}`, filters };
  }
  if (match[3] === "code" || match[3] === "commits") {
    const ref = p.get("branch") || undefined;
    return { ...base, kind: "code", key: `${prefix}/code?${JSON.stringify(ref ?? null)}`, ref };
  }
  const params: Record<string, string | number> = {};
  for (const field of ["actor", "branch", "event", "status"] as const)
    if (p.get(field)) params[field] = p.get(field)!;
  const workflow = Number(p.get("workflow"));
  if (Number.isSafeInteger(workflow) && workflow > 0) params.workflow_id = workflow;
  const run = match[4] ? Number(match[4]) : undefined;
  return {
    ...base,
    kind: "actions",
    key: `${prefix}/actions${run ? `/runs/${run}` : `?${JSON.stringify(params)}`}`,
    run,
    params,
  };
}

export function usePullActivityFilter(text: string) {
  const { tabId } = useTabScope();
  useLayoutEffect(() => {
    if (tabId)
      useIssueActivityFilters.setState((s) => ({ pullText: { ...s.pullText, [tabId]: text } }));
  }, [tabId, text]);
}
