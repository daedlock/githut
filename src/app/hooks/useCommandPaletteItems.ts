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

export function useCommandPaletteSearch(query: string) {
  const token = useAuthStore((s) => s.token);
  const debounced = useDebouncedValue(query, 200);
  const trimmed = debounced.trim();

  return useQuery({
    queryKey: ["command-palette", "search", trimmed],
    enabled: !!token && trimmed.length >= 2,
    staleTime: 30_000,
    // Keep the previous list visible across keystrokes so the section doesn't
    // collapse+expand between results — matches the CommentBox mention UX.
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<SearchHit[]> => {
      const client = getGitHubClient();
      const res = await client.request("GET /search/issues", {
        q: trimmed,
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

// ─── Query-string mode parsing ────────────────────────────────────────────────

export type PaletteMode =
  | { kind: "all"; query: string }
  | { kind: "actions"; query: string }
  | { kind: "repos"; query: string }
  | { kind: "number"; number: number };

export function parsePaletteQuery(raw: string): PaletteMode {
  const q = raw.trim();
  if (q.startsWith(">")) return { kind: "actions", query: q.slice(1).trim() };
  if (q.startsWith("@")) return { kind: "repos", query: q.slice(1).trim() };
  // `#123` jumps to a specific issue/PR in the current repo context; so does a
  // bare number. We only treat purely-numeric input this way — "#feature" is
  // still a normal search for the label-like string.
  const hashNum = /^#(\d+)$/.exec(q);
  if (hashNum) return { kind: "number", number: Number(hashNum[1]) };
  if (/^\d+$/.test(q)) return { kind: "number", number: Number(q) };
  return { kind: "all", query: q };
}

// ─── Tiny local state hook so components can share the query ─────────────────

export function usePaletteQueryState() {
  const [value, setValue] = useState("");
  return { value, setValue } as const;
}
