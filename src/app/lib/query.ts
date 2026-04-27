import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 24 * 60 * 60 * 1000,
      refetchOnWindowFocus: true,
      retry: (failureCount, error) => {
        // Never retry auth failures — the token is gone, retrying just loops.
        if ("status" in error && error.status === 401) return false;
        return failureCount < 1;
      },
    },
  },
});
