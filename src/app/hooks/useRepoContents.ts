import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { getGitHubClient } from "@/app/lib/github/client";
import { useAuthStore } from "@/app/stores/auth";

const ContentEntrySchema = z.object({
  type: z.enum(["file", "dir", "symlink", "submodule"]),
  name: z.string(),
  path: z.string(),
  sha: z.string(),
  size: z.number(),
  html_url: z.string().nullable(),
  download_url: z.string().nullable(),
});

export type ContentEntry = z.infer<typeof ContentEntrySchema>;

const DirContentsSchema = z.array(ContentEntrySchema);

export function useRepoContents(owner: string, repo: string, path = "", ref?: string) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ["repo-contents", owner, repo, path, ref ?? "default"],
    enabled: !!token && !!owner && !!repo,
    staleTime: 60_000,
    queryFn: async (): Promise<ContentEntry[]> => {
      const client = getGitHubClient();
      const res = await client.request("GET /repos/{owner}/{repo}/contents/{path}", {
        owner,
        repo,
        path,
        ...(ref ? { ref } : {}),
      });
      const data = Array.isArray(res.data) ? res.data : [res.data];
      return DirContentsSchema.parse(data);
    },
  });
}
