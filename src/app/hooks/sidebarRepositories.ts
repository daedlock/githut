import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useDebouncedValue } from "@/app/hooks/useDebouncedValue";
import { getGitHubClient } from "@/app/lib/github/client";
import { useAuthStore } from "@/app/stores/auth";

const repository = z.object({ id: z.number(), name: z.string(), full_name: z.string() });
const organization = z.object({ id: z.number(), login: z.string(), avatar_url: z.string() });
export type SidebarRepository = z.infer<typeof repository>;
export type SidebarOrganization = z.infer<typeof organization>;

/** Sidebar lists fetch a page at a time: the first shows at once, the rest on "Show more". */
export const SIDEBAR_PAGE_SIZE = 30;

type Page<T> = { items: T[]; next: number | null };

async function fetchPage<T>(
  route: string,
  params: Record<string, string>,
  schema: z.ZodType<T>,
  page: number,
  signal?: AbortSignal,
): Promise<Page<T>> {
  const response = await getGitHubClient().request(route, {
    ...params,
    page,
    per_page: SIDEBAR_PAGE_SIZE,
    request: { signal },
  });
  return {
    items: z.array(schema).parse(response.data),
    next: response.headers.link?.includes('rel="next"') ? page + 1 : null,
  };
}

export const fetchYourRepositories = (page = 1, signal?: AbortSignal) =>
  fetchPage(
    "GET /user/repos",
    { affiliation: "owner,collaborator", visibility: "all", sort: "pushed", direction: "desc" },
    repository,
    page,
    signal,
  );
export const fetchOrganizationRepositories = (org: string, page = 1, signal?: AbortSignal) =>
  fetchPage(
    "GET /orgs/{org}/repos",
    { org, type: "all", sort: "pushed", direction: "desc" },
    repository,
    page,
    signal,
  );

export type RepositoryList = {
  items: SidebarRepository[];
  isPending: boolean;
  isError: boolean;
  isSuccess: boolean;
  /** `"paused"` while a request waits to come back online. */
  fetchStatus: string;
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => void;
  refetch: () => void;
};

function useRepositoryPages(
  key: readonly unknown[],
  fetch: (page: number, signal: AbortSignal) => Promise<Page<SidebarRepository>>,
  enabled: boolean,
): RepositoryList {
  const query = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam, signal }) => fetch(pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: (last) => last.next,
    enabled,
    staleTime: 5 * 60_000,
  });
  // Pushes reorder a pushed-sorted list between page requests; dedupe by id.
  const seen = new Set<number>();
  const items = (query.data?.pages ?? [])
    .flatMap((page) => page.items)
    .filter((repo) => !seen.has(repo.id) && !!seen.add(repo.id));
  return {
    items,
    isPending: query.isPending,
    isError: query.isError,
    isSuccess: query.isSuccess,
    fetchStatus: query.fetchStatus,
    hasMore: query.hasNextPage,
    loadingMore: query.isFetchingNextPage,
    loadMore: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
    },
    refetch: () => void query.refetch(),
  };
}

export function useYourRepositories(): RepositoryList {
  const accountId = useAuthStore((state) => state.accountId);
  return useRepositoryPages(
    ["sidebar", "your-repos", accountId],
    (page, signal) => fetchYourRepositories(page, signal),
    !!accountId,
  );
}

export function useOrganizationRepositories(org: string, expanded: boolean): RepositoryList {
  const accountId = useAuthStore((state) => state.accountId);
  return useRepositoryPages(
    ["sidebar", "org-repos", accountId, org],
    (page, signal) => fetchOrganizationRepositories(org, page, signal),
    !!accountId && expanded,
  );
}

/** Organizations are few; one page of 100 covers nearly everyone. */
export function useSidebarOrganizations() {
  const accountId = useAuthStore((state) => state.accountId);
  return useQuery({
    queryKey: ["sidebar", "organizations", accountId],
    queryFn: async ({ signal }) => {
      const response = await getGitHubClient().request("GET /user/orgs", {
        per_page: 100,
        request: { signal },
      });
      return z.array(organization).parse(response.data);
    },
    enabled: !!accountId,
    staleTime: 5 * 60_000,
  });
}

/**
 * Filtering a list that isn't fully loaded asks GitHub by name, so a match
 * on a page nobody opened still turns up. `qualifier` scopes the search
 * (`org:acme`, `user:me`).
 */
export function useRepositorySearch(qualifier: string | null, term: string, enabled: boolean) {
  const accountId = useAuthStore((state) => state.accountId);
  const debounced = useDebouncedValue(term.trim(), 300);
  return useQuery({
    queryKey: ["sidebar", "repo-search", accountId, qualifier, debounced],
    queryFn: async ({ signal }) => {
      const response = await getGitHubClient().request("GET /search/repositories", {
        q: `${debounced} in:name ${qualifier}`,
        per_page: 10,
        request: { signal },
      });
      return z.object({ items: z.array(repository) }).parse(response.data).items;
    },
    enabled: enabled && !!accountId && !!qualifier && debounced.length >= 2,
    staleTime: 60_000,
  });
}
