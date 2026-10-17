import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { getGitHubClient } from "@/app/lib/github/client";
import { retrySessionExpiry } from "@/app/lib/query";
import { useAuthStore } from "@/app/stores/auth";

const MeSchema = z.object({
  login: z.string(),
  name: z.string().nullable().optional(),
  avatar_url: z.string(),
  html_url: z.string(),
  id: z.number(),
});

export type Me = z.infer<typeof MeSchema>;

export function useMe() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ["me"],
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
    // Drafts can only be filed under an account once /user answers, so keep
    // trying through rate limits and blips (a 401 waits for sign-in again).
    retry: (failures, error) =>
      (error as { status?: number } | null)?.status === 401
        ? retrySessionExpiry(failures, error)
        : failures < 5,
    retryDelay: (attempt) => Math.min(30_000, 1000 * 2 ** attempt),
    queryFn: async () => {
      const client = getGitHubClient();
      const res = await client.request("GET /user");
      const me = MeSchema.parse(res.data);
      if (token) useAuthStore.getState().verifyAccount(token, me.id);
      return me;
    },
  });
}
