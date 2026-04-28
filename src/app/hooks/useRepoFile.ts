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

// A full 40-char hex SHA pins the response to an immutable blob — safe to cache forever.
// Branch names like "main" or omitted refs can change, so they get a shorter stale window.
const SHA_REF = /^[a-f0-9]{40}$/i;

export function useRepoFile(
  owner: string,
  repo: string,
  path: string,
  ref?: string,
  options?: { enabled?: boolean },
) {
  const token = useAuthStore((s) => s.token);
  const isImmutable = !!ref && SHA_REF.test(ref);
  return useQuery({
    queryKey: ["repo-file", owner, repo, path, ref ?? "default"],
    enabled: !!token && !!owner && !!repo && !!path && (options?.enabled ?? true),
    staleTime: isImmutable ? Infinity : 5 * 60_000,
    gcTime: isImmutable ? 10 * 60_000 : undefined,
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
