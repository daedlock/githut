import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useSyncExternalStore } from "react";
import { z } from "zod";
import { getGitHubClient } from "@/app/lib/github/client";
import {
  getRecentItemsSync,
  hydrateRecentItems,
  type RecentItem,
  subscribeRecentItems,
} from "@/app/lib/recentItems";
import { useAuthStore } from "@/app/stores/auth";
import { useDebouncedValue } from "./useDebouncedValue";

/**
 * Hooks that feed the command palette sections. Split out from the component
 * so the palette body stays about layout + keyboard, and the sources stay
 * about data. Each hook returns an array of items with just the fields the
 * palette row needs.
 */

// ─── Recent ───────────────────────────────────────────────────────────────────

export function useRecentItems(limit = 5): RecentItem[] {
  // Hydrate on first consumer mount so the in-memory mirror is warm.
  useEffect(() => {
    void hydrateRecentItems();
  }, []);
  const items = useSyncExternalStore(subscribeRecentItems, getRecentItemsSync, getRecentItemsSync);
  return items.slice(0, limit);
}

// ─── Search ───────────────────────────────────────────────────────────────────

export type SearchHit = {
  id: string;
  kind: "issue" | "pr";
  state: "open" | "closed";
  number: number;
  title: string;
  repoFullName: string;
  href: string;
};

export type RepoSearchContext = { owner: string; repo: string };

const SearchResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.number(),
      number: z.number(),
      title: z.string(),
      state: z.string(),
      html_url: z.string(),
      repository_url: z.string(),
      pull_request: z.unknown().optional(),
    }),
  ),
});

// Turn the GitHub-issued `repository_url` (api.github.com/repos/:o/:r) into
// the owner/repo pair the SPA uses to build in-app routes. html_url would
// work too but navigating via the raw GitHub URL would bounce the user off
// the app; parse the API URL so we stay in-house.
function ownerRepoFromApiUrl(apiUrl: string): { owner: string; repo: string } | null {
  const m = /\/repos\/([^/]+)\/([^/]+)$/.exec(apiUrl);
  if (!m) return null;
  return { owner: m[1]!, repo: m[2]! };
}

export function useCommandPaletteSearch(
  query: string,
  options?: { repoContext?: RepoSearchContext | null; enabled?: boolean },
) {
  const token = useAuthStore((s) => s.token);
  const debounced = useDebouncedValue(query, 200);
  const trimmed = debounced.trim();
  const repoContext = options?.repoContext ?? null;
  const enabled = options?.enabled ?? true;

  return useQuery({
    queryKey: [
      "command-palette",
      "search",
      repoContext?.owner ?? "global",
      repoContext?.repo ?? "global",
      trimmed,
    ],
    enabled: !!token && enabled && trimmed.length >= 2,
    staleTime: 30_000,
    // Keep the previous list visible across keystrokes so the section doesn't
    // collapse+expand between results — matches the CommentBox mention UX.
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<SearchHit[]> => {
      const client = getGitHubClient();
      const repoQualifier = repoContext ? `repo:${repoContext.owner}/${repoContext.repo}` : "";
      const res = await client.request("GET /search/issues", {
        q: [trimmed, repoQualifier].filter(Boolean).join(" "),
        per_page: 10,
      });
      const parsed = SearchResponseSchema.parse(res.data);
      return parsed.items
        .map((item): SearchHit | null => {
          const rr = ownerRepoFromApiUrl(item.repository_url);
          if (!rr) return null;
          const isPR = !!item.pull_request;
          const href = isPR
            ? `/${rr.owner}/${rr.repo}/pull/${item.number}`
            : `/${rr.owner}/${rr.repo}/issues/${item.number}`;
          return {
            id: String(item.id),
            kind: isPR ? "pr" : "issue",
            state: item.state === "closed" ? "closed" : "open",
            number: item.number,
            title: item.title,
            repoFullName: `${rr.owner}/${rr.repo}`,
            href,
          };
        })
        .filter((x): x is SearchHit => x !== null);
    },
  });
}

// ─── File-path and code search ────────────────────────────────────────────────

const RepoTreeEntrySchema = z.object({
  path: z.string(),
  mode: z.string().optional(),
  type: z.enum(["blob", "tree", "commit"]),
  sha: z.string(),
  size: z.number().optional(),
});

const RepoTreeSchema = z.object({
  tree: z.array(RepoTreeEntrySchema),
  truncated: z.boolean().optional().default(false),
});

export type RepoTree = z.infer<typeof RepoTreeSchema>;
export type RepoTreeEntry = z.infer<typeof RepoTreeEntrySchema>;
export type RepoPathHit = RepoTreeEntry & { kind: "file" | "dir"; score: number };

export function useRepoTree(
  owner: string,
  repo: string,
  ref = "HEAD",
  options?: { enabled?: boolean },
) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ["repo-tree", owner, repo, ref] as const,
    enabled: !!token && !!owner && !!repo && (options?.enabled ?? true),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<RepoTree> => {
      const client = getGitHubClient();
      const res = await client.request("GET /repos/{owner}/{repo}/git/trees/{tree_sha}", {
        owner,
        repo,
        tree_sha: ref,
        recursive: "1",
      });
      return RepoTreeSchema.parse(res.data);
    },
  });
}

const CodeSearchResponseSchema = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      path: z.string(),
      sha: z.string(),
      html_url: z.string(),
      repository: z.object({ full_name: z.string() }),
    }),
  ),
});

export type CodeSearchHit = {
  id: string;
  name: string;
  path: string;
  sha: string;
  href: string;
  repositoryFullName: string;
};

export function useCodeSearch(
  query: string,
  repoContext: RepoSearchContext | null,
  options?: { enabled?: boolean },
) {
  const token = useAuthStore((s) => s.token);
  const debounced = useDebouncedValue(query, 200);
  const trimmed = debounced.trim();
  const enabled = options?.enabled ?? true;

  return useQuery({
    queryKey: [
      "command-palette",
      "code-search",
      repoContext?.owner ?? "none",
      repoContext?.repo ?? "none",
      trimmed,
    ],
    enabled: !!token && enabled && !!repoContext && trimmed.length >= 3,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<CodeSearchHit[]> => {
      if (!repoContext) return [];
      const client = getGitHubClient();
      const res = await client.request("GET /search/code", {
        q: `${trimmed} in:file repo:${repoContext.owner}/${repoContext.repo}`,
        per_page: 8,
      });
      const parsed = CodeSearchResponseSchema.parse(res.data);
      return parsed.items.map((item) => ({
        id: `${item.repository.full_name}:${item.sha}:${item.path}`,
        name: item.name,
        path: item.path,
        sha: item.sha,
        href: item.html_url,
        repositoryFullName: item.repository.full_name,
      }));
    },
  });
}

export function rankRepoPaths(
  tree: RepoTree | undefined,
  query: string,
  limit = 12,
): RepoPathHit[] {
  const q = query.trim();
  if (!tree || !q) return [];

  return tree.tree
    .filter((entry) => entry.type === "blob" || entry.type === "tree")
    .map((entry): RepoPathHit | null => {
      const score = scorePath(entry.path, q);
      if (score === null) return null;
      return {
        ...entry,
        kind: entry.type === "tree" ? "dir" : "file",
        score,
      };
    })
    .filter((entry): entry is RepoPathHit => entry !== null)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, limit);
}

function scorePath(path: string, query: string): number | null {
  const parts = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;

  let total = 0;
  for (const part of parts) {
    const score = scorePathPart(path, part);
    if (score === null) return null;
    total += score;
  }
  return total / parts.length;
}

function scorePathPart(path: string, query: string): number | null {
  const lower = path.toLowerCase();
  const basename = lower.split("/").pop() ?? lower;

  if (basename === query) return 1000;
  if (basename.startsWith(query)) return 880 - basename.length * 0.5;

  const basenameIndex = basename.indexOf(query);
  if (basenameIndex >= 0) return 760 - basenameIndex;

  const pathIndex = lower.indexOf(query);
  if (pathIndex >= 0) return 620 - pathIndex * 0.1;

  let lastIndex = -1;
  let gaps = 0;
  let boundaryBonus = 0;
  for (const char of query) {
    const nextIndex = lower.indexOf(char, lastIndex + 1);
    if (nextIndex === -1) return null;
    if (lastIndex >= 0) gaps += nextIndex - lastIndex - 1;
    if (nextIndex === 0 || lower[nextIndex - 1] === "/" || lower[nextIndex - 1] === "-") {
      boundaryBonus += 18;
    }
    lastIndex = nextIndex;
  }

  return 420 + boundaryBonus - gaps;
}

// ─── Query-string mode parsing ────────────────────────────────────────────────

export type PaletteMode =
  | { kind: "all"; query: string }
  | { kind: "actions"; query: string }
  | { kind: "repos"; query: string }
  | { kind: "issues"; query: string }
  | { kind: "files"; query: string }
  | { kind: "number"; number: number };

export function parsePaletteQuery(raw: string): PaletteMode {
  const q = raw.trim();
  if (q.startsWith(">")) return { kind: "actions", query: q.slice(1).trim() };
  if (q.startsWith("@")) return { kind: "repos", query: q.slice(1).trim() };
  if (q.startsWith("/")) return { kind: "files", query: q.slice(1).trim() };
  // `#123` jumps to a specific issue/PR in the current repo context; so does a
  // bare number. Non-numeric `#` input becomes fuzzy issue/PR search.
  const hashNum = /^#(\d+)$/.exec(q);
  if (hashNum) return { kind: "number", number: Number(hashNum[1]) };
  if (q.startsWith("#")) return { kind: "issues", query: q.slice(1).trim() };
  if (/^\d+$/.test(q)) return { kind: "number", number: Number(q) };
  return { kind: "all", query: q };
}

// ─── Tiny local state hook so components can share the query ─────────────────

export function usePaletteQueryState() {
  const [value, setValue] = useState("");
  return { value, setValue } as const;
}
