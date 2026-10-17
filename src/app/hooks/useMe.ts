import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { getGitHubClient } from "@/app/lib/github/client";
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
    retry: false,
    queryFn: async () => {
      const client = getGitHubClient();
      const res = await client.request("GET /user");
      const me = MeSchema.parse(res.data);
      if (token) useAuthStore.getState().verifyAccount(token, me.id);
      return me;
    },
  });
}
