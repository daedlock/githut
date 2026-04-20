import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { getGitHubClient } from "@/app/lib/github/client";
import { useAuthStore } from "@/app/stores/auth";

const FileSchema = z.object({
  type: z.literal("file"),
  name: z.string(),
  path: z.string(),
  sha: z.string(),
  size: z.number(),
  encoding: z.string(),
  content: z.string(),
});

export type RepoFile = {
  path: string;
  name: string;
  size: number;
  content: string;
};

function decodeBase64(b64: string): string {
  const clean = b64.replace(/\s/g, "");
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder("utf-8").decode(bytes);
}

export function useRepoFile(owner: string, repo: string, path: string, ref?: string) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ["repo-file", owner, repo, path, ref ?? "default"],
    enabled: !!token && !!owner && !!repo && !!path,
    staleTime: 60_000,
    queryFn: async (): Promise<RepoFile> => {
      const client = getGitHubClient();
      const res = await client.request("GET /repos/{owner}/{repo}/contents/{path}", {
        owner,
        repo,
        path,
        ...(ref ? { ref } : {}),
      });
      const parsed = FileSchema.parse(res.data);
      return {
        path: parsed.path,
        name: parsed.name,
        size: parsed.size,
        content: decodeBase64(parsed.content),
      };
    },
  });
}
