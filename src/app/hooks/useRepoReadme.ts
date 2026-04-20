import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { getGitHubClient } from "@/app/lib/github/client";
import { useAuthStore } from "@/app/stores/auth";

const ReadmeSchema = z.object({
  name: z.string(),
  path: z.string(),
  sha: z.string(),
  encoding: z.string(),
  content: z.string(),
  html_url: z.string().nullable(),
  download_url: z.string().nullable(),
});

export type ReadmePayload = {
  path: string;
  markdown: string;
};

function decodeBase64(b64: string): string {
  const clean = b64.replace(/\s/g, "");
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder("utf-8").decode(bytes);
}

export function useRepoReadme(owner: string, repo: string, ref?: string) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ["repo-readme", owner, repo, ref ?? "default"],
    enabled: !!token && !!owner && !!repo,
    staleTime: 60_000,
    retry: false,
    queryFn: async (): Promise<ReadmePayload | null> => {
      const client = getGitHubClient();
      try {
        const res = await client.request("GET /repos/{owner}/{repo}/readme", {
          owner,
          repo,
          ...(ref ? { ref } : {}),
        });
        const parsed = ReadmeSchema.parse(res.data);
        return { path: parsed.path, markdown: decodeBase64(parsed.content) };
      } catch (err) {
        if ((err as { status?: number }).status === 404) return null;
        throw err;
      }
    },
  });
}
