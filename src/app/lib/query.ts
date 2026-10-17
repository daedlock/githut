import { MutationCache, QueryClient } from "@tanstack/react-query";
// Wires TanStack's onlineManager to browser connectivity + session expiry.
import { assertCanMutate } from "@/app/lib/connectivity";

function isUnauthorized(error: unknown): boolean {
  return !!error && typeof error === "object" && "status" in error && error.status === 401;
}

/** Keep a cached page mounted while its unauthorized retry waits for sign-in. */
export function retrySessionExpiry(failureCount: number, error: unknown): boolean {
  return isUnauthorized(error) && failureCount < 2;
}

// Set only while one tab's island takes focus (`refreshTabOnFocus`): window
// focus refreshes every stale query on screen, island focus only that tab's.
let focusScope: string | null = null;

/** `refetchOnWindowFocus` for observers owned by `tabId` (null: outside tabs). */
export function refetchOnFocusFor(tabId: string | null) {
  return () => focusScope === null || focusScope === tabId;
}

export const queryClient = new QueryClient({
  mutationCache: new MutationCache({ onMutate: () => assertCanMutate() }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 24 * 60 * 60 * 1000,
      refetchOnWindowFocus: refetchOnFocusFor(null),
      retry: (failureCount, error) => {
        // A 401 marks the session expired, which takes the onlineManager
        // offline: the retry then pauses (keeping cached data on screen)
        // until the user signs in again, instead of erroring the page.
        if (isUnauthorized(error)) return failureCount < 2;
        return failureCount < 1;
      },
    },
    mutations: {
      // Fail fast rather than queue: an action taken offline (or with an
      // expired token) must not fire unexpectedly on reconnect. The main
      // action buttons are disabled in those states anyway (useCanMutate).
      networkMode: "always",
    },
  },
});

/**
 * A tab's view of the shared cache: the same queries and mutations, so data,
 * invalidation and refetch-on-mount behave exactly as on the shared client.
 * The only difference is which island focus refreshes its observers. It never
 * mounts: the shared client already forwards window focus and reconnects.
 */
class TabQueryClient extends QueryClient {
  override mount() {}
  override unmount() {}
}

export function tabQueryClient(tabId: string): QueryClient {
  const defaults = queryClient.getDefaultOptions();
  return new TabQueryClient({
    queryCache: queryClient.getQueryCache(),
    mutationCache: queryClient.getMutationCache(),
    defaultOptions: {
      ...defaults,
      queries: { ...defaults.queries, refetchOnWindowFocus: refetchOnFocusFor(tabId) },
    },
  });
}

/** Refetch the stale queries observed by one tab, the way window focus would. */
export function refreshTabOnFocus(tabId: string) {
  focusScope = tabId;
  try {
    queryClient.getQueryCache().onFocus();
  } finally {
    focusScope = null;
  }
}

/**
 * Subscribe to cached data changing (a fetch or setQueryData landing, a query
 * added or removed), not to every fetch-status or observer event: cache-wide
 * listeners otherwise run on each tick of every polling query.
 */
export function subscribeQueryData(changed: () => void): () => void {
  return queryClient.getQueryCache().subscribe((event) => {
    if (event.type === "added" || event.type === "removed") changed();
    else if (event.type === "updated" && event.action.type === "success") changed();
  });
}
