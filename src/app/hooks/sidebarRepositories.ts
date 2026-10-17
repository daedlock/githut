import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { getGitHubClient } from "@/app/lib/github/client";
import { useAuthStore } from "@/app/stores/auth";

const repository = z.object({ id: z.number(), name: z.string(), full_name: z.string() });
const organization = z.object({ id: z.number(), login: z.string() });
export type SidebarRepository = z.infer<typeof repository>;

async function collect<T extends { id: number }>(
  route: string,
  params: Record<string, string>,
  schema: z.ZodType<T>,
  signal?: AbortSignal,
): Promise<T[]> {
  const client = getGitHubClient();
  const items = new Map<number, T>();
  for (let page = 1; ; page++) {
    const response = await client.request(route, {
      ...params,
      page,
      per_page: 100,
      request: { signal },
    });
    const entries = z.array(schema).parse(response.data);
    for (const item of entries) items.set(item.id, item);
    if (!response.headers.link?.includes('rel="next"')) break;
  }
  return [...items.values()];
}

export const fetchYourRepositories = (signal?: AbortSignal) =>
  collect(
    "GET /user/repos",
    { affiliation: "owner,collaborator", visibility: "all", sort: "pushed", direction: "desc" },
    repository,
    signal,
  );
export const fetchSidebarOrganizations = (signal?: AbortSignal) =>
  collect("GET /user/orgs", {}, organization, signal);
export const fetchOrganizationRepositories = (org: string, signal?: AbortSignal) =>
  collect(
    "GET /orgs/{org}/repos",
    { org, type: "all", sort: "pushed", direction: "desc" },
    repository,
    signal,
  );

export function useYourRepositories() {
  const accountId = useAuthStore((state) => state.accountId);
  return useQuery({
    queryKey: ["sidebar", "your-repos", accountId],
    queryFn: ({ signal }) => fetchYourRepositories(signal),
    enabled: !!accountId,
    staleTime: 5 * 60_000,
  });
}
export function useSidebarOrganizations() {
  const accountId = useAuthStore((state) => state.accountId);
  return useQuery({
    queryKey: ["sidebar", "organizations", accountId],
    queryFn: ({ signal }) => fetchSidebarOrganizations(signal),
    enabled: !!accountId,
    staleTime: 5 * 60_000,
  });
}
export function useOrganizationRepositories(org: string, expanded: boolean) {
  const accountId = useAuthStore((state) => state.accountId);
  return useQuery({
    queryKey: ["sidebar", "org-repos", accountId, org],
    queryFn: ({ signal }) => fetchOrganizationRepositories(org, signal),
    enabled: !!accountId && expanded,
    staleTime: 5 * 60_000,
  });
}
