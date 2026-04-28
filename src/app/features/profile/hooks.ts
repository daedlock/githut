import { queryOptions, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { getGitHubClient } from "@/app/lib/github/client";
import { useAuthStore } from "@/app/stores/auth";
import type { RepoSummary } from "@/shared/types";
import {
  type GitHubEvent,
  GitHubEventSchema,
  type GitHubProfile,
  GitHubProfileSchema,
  type OrgMember,
  OrgMemberSchema,
  ProfileRepoSchema,
  type UserOrg,
  UserOrgSchema,
} from "./schemas";

// ─── Query keys ────────────────────────────────────────────────────────────

export const profileKeys = {
  user: (login: string) => ["profile", login] as const,
  repos: (login: string) => ["profile-repos", login] as const,
  orgs: (login: string) => ["profile-orgs", login] as const,
  members: (org: string) => ["profile-members", org] as const,
  readme: (login: string, isOrg: boolean) => ["profile-readme", login, isOrg] as const,
  events: (login: string, isOrg: boolean) => ["profile-events", login, isOrg] as const,
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function decodeBase64Utf8(b64: string): string {
  const clean = b64.replace(/\s/g, "");
  const binary = atob(clean);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

// ─── Transforms ────────────────────────────────────────────────────────────

function toRepoSummary(r: z.infer<typeof ProfileRepoSchema>): RepoSummary {
  return {
    id: r.id,
    name: r.name,
    fullName: r.full_name,
    owner: { login: r.owner.login, avatarUrl: r.owner.avatar_url, type: r.owner.type },
    description: r.description,
    language: r.language,
    stars: r.stargazers_count,
    pushedAt: r.pushed_at ?? new Date(0).toISOString(),
    visibility: r.private ? "private" : "public",
  };
}

// ─── Query options ─────────────────────────────────────────────────────────

export const profileQueryOptions = (login: string) =>
  queryOptions({
    queryKey: profileKeys.user(login),
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<GitHubProfile> => {
      const client = getGitHubClient();
      const res = await client.request("GET /users/{username}", { username: login });
      return GitHubProfileSchema.parse(res.data);
    },
  });

export const profileReposQueryOptions = (login: string, isOrg: boolean) =>
  queryOptions({
    queryKey: profileKeys.repos(login),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<RepoSummary[]> => {
      const client = getGitHubClient();
      const res = isOrg
        ? await client.request("GET /orgs/{org}/repos", {
            org: login,
            type: "all",
            sort: "pushed",
            direction: "desc",
            per_page: 100,
          })
        : await client.request("GET /users/{username}/repos", {
            username: login,
            type: "owner",
            sort: "pushed",
            direction: "desc",
            per_page: 100,
          });
      return z.array(ProfileRepoSchema).parse(res.data).map(toRepoSummary);
    },
  });

export const userOrgsQueryOptions = (login: string) =>
  queryOptions({
    queryKey: profileKeys.orgs(login),
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<UserOrg[]> => {
      const client = getGitHubClient();
      const res = await client.request("GET /users/{username}/orgs", {
        username: login,
        per_page: 100,
      });
      return z.array(UserOrgSchema).parse(res.data);
    },
  });

export const profileReadmeQueryOptions = (login: string, isOrg: boolean) =>
  queryOptions({
    queryKey: profileKeys.readme(login, isOrg),
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: async (): Promise<string | null> => {
      const client = getGitHubClient();
      try {
        if (isOrg) {
          const res = await client.request("GET /repos/{owner}/{repo}/contents/{path}", {
            owner: login,
            repo: ".github",
            path: "profile/README.md",
          });
          const data = res.data as { content?: string; encoding?: string };
          if (data.encoding === "base64" && data.content) return decodeBase64Utf8(data.content);
          return null;
        }
        const res = await client.request("GET /repos/{owner}/{repo}/readme", {
          owner: login,
          repo: login,
        });
        if (res.data.encoding === "base64" && res.data.content) {
          return decodeBase64Utf8(res.data.content);
        }
        return null;
      } catch {
        return null;
      }
    },
  });

/**
 * Last ~90 days of public events for a user/org. Powers the activity
 * heatmap and the "Latest activity" widget. Returns `[]` rather than
 * throwing for 404/private profiles — empty heatmap is the right UX.
 */
export const userEventsQueryOptions = (login: string, isOrg: boolean) =>
  queryOptions({
    queryKey: profileKeys.events(login, isOrg),
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: async (): Promise<GitHubEvent[]> => {
      const client = getGitHubClient();
      try {
        const res = isOrg
          ? await client.request("GET /orgs/{org}/events", {
              org: login,
              per_page: 100,
            })
          : await client.request("GET /users/{username}/events/public", {
              username: login,
              per_page: 100,
            });
        const parsed = z.array(GitHubEventSchema).safeParse(res.data);
        return parsed.success ? parsed.data : [];
      } catch {
        return [];
      }
    },
  });

export const orgMembersQueryOptions = (org: string) =>
  queryOptions({
    queryKey: profileKeys.members(org),
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: async (): Promise<OrgMember[]> => {
      const client = getGitHubClient();
      const res = await client.request("GET /orgs/{org}/members", {
        org,
        per_page: 100,
      });
      return z.array(OrgMemberSchema).parse(res.data);
    },
  });

// ─── Hooks ─────────────────────────────────────────────────────────────────

/** Fetch a user or organization profile. Works for both via GET /users/{login}. */
export function useProfile(login: string) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    ...profileQueryOptions(login),
    enabled: !!token && !!login,
  });
}

/** Fetch repositories for a user or org profile page. */
export function useProfileRepos(login: string, isOrg: boolean) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    ...profileReposQueryOptions(login, isOrg),
    enabled: !!token && !!login,
  });
}

/** Fetch organizations a user belongs to. */
export function useUserOrgs(login: string) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    ...userOrgsQueryOptions(login),
    enabled: !!token && !!login,
  });
}

/**
 * Fetch the profile README markdown for a user or org.
 *
 *   User: `{login}/{login}` repo → README at root
 *   Org:  `{login}/.github`   repo → `profile/README.md`
 *
 * Returns `null` (not an error) when the special repo doesn't exist — that's
 * the common case and shouldn't poison the query state.
 */
export function useProfileReadme(login: string, isOrg: boolean | undefined) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    ...profileReadmeQueryOptions(login, !!isOrg),
    enabled: !!token && !!login && isOrg !== undefined,
  });
}

/** Fetch the last ~90 days of public events. Empty array on error. */
export function useUserEvents(login: string, isOrg: boolean | undefined) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    ...userEventsQueryOptions(login, !!isOrg),
    enabled: !!token && !!login && isOrg !== undefined,
  });
}

/** Fetch members of an organization. Requires authenticated org membership. */
export function useOrgMembers(org: string) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    ...orgMembersQueryOptions(org),
    enabled: !!token && !!org,
  });
}
