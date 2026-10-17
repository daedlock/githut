import { QueryClient } from "@tanstack/react-query";
// Wires TanStack's onlineManager to browser connectivity + session expiry.
import "@/app/lib/connectivity";

function isUnauthorized(error: unknown): boolean {
  return !!error && typeof error === "object" && "status" in error && error.status === 401;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 24 * 60 * 60 * 1000,
      refetchOnWindowFocus: true,
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
