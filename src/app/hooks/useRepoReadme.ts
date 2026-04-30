import { queryOptions, useQuery } from "@tanstack/react-query";
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

const ContentEntrySchema = z.object({
  type: z.string(),
  name: z.string(),
  path: z.string(),
});

const ContentFileSchema = z.object({
  path: z.string(),
  encoding: z.string().optional(),
  content: z.string().optional(),
});

export type ReadmePayload = {
  path: string;
  content: string;
};

type GitHubClient = ReturnType<typeof getGitHubClient>;

function decodeBase64(b64: string): string {
  const clean = b64.replace(/\s/g, "");
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder("utf-8").decode(bytes);
}

function readmeFromBase64(path: string, encoding: string | undefined, content: string | undefined) {
  if (encoding !== "base64" || !content) return null;
  return { path, content: decodeBase64(content) } satisfies ReadmePayload;
}

async function fetchRootOrgReadme(
  client: GitHubClient,
  owner: string,
  repo: string,
  ref?: string,
): Promise<ReadmePayload | null> {
  try {
    const root = await client.request("GET /repos/{owner}/{repo}/contents/{path}", {
      owner,
      repo,
      path: "",
      ...(ref ? { ref } : {}),
    });
    if (!Array.isArray(root.data)) return null;

    const entries = z.array(ContentEntrySchema).parse(root.data);
    const orgReadme = entries.find(
      (entry) => entry.type === "file" && entry.name.toLowerCase() === "readme.org",
    );
    if (!orgReadme) return null;

    const file = await client.request("GET /repos/{owner}/{repo}/contents/{path}", {
      owner,
      repo,
      path: orgReadme.path,
      ...(ref ? { ref } : {}),
    });
    if (Array.isArray(file.data)) return null;

    const parsed = ContentFileSchema.parse(file.data);
    return readmeFromBase64(parsed.path, parsed.encoding, parsed.content);
  } catch (err) {
    if ((err as { status?: number }).status === 404) return null;
    throw err;
  }
}

export const repoReadmeQueryOptions = (owner: string, repo: string, ref?: string) =>
  queryOptions({
    queryKey: ["repo-readme", owner, repo, ref ?? "default"] as const,
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
        return readmeFromBase64(parsed.path, parsed.encoding, parsed.content);
      } catch (err) {
        if ((err as { status?: number }).status === 404) {
          // GitHub's README endpoint handles most markup variants, but this
          // keeps README.org working even if the endpoint declines to resolve it.
          return fetchRootOrgReadme(client, owner, repo, ref);
        }
        throw err;
      }
    },
  });

export function useRepoReadme(
  owner: string,
  repo: string,
  ref?: string,
  options?: { enabled?: boolean },
) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    ...repoReadmeQueryOptions(owner, repo, ref),
    enabled: !!token && !!owner && !!repo && (options?.enabled ?? true),
  });
}
