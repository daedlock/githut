import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { getGitHubClient } from "@/app/lib/github/client";
import { useAuthStore } from "@/app/stores/auth";
import type { RepoSummary } from "@/shared/types";
import {
  GitHubProfileSchema,
  OrgMemberSchema,
  ProfileRepoSchema,
  UserOrgSchema,
  type GitHubProfile,
  type OrgMember,
  type UserOrg,
} from "./schemas";

// ─── Query keys ────────────────────────────────────────────────────────────

export const profileKeys = {
  user: (login: string) => ["profile", login] as const,
  repos: (login: string) => ["profile-repos", login] as const,
  orgs: (login: string) => ["profile-orgs", login] as const,
  members: (org: string) => ["profile-members", org] as const,
};

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

// ─── Queries ───────────────────────────────────────────────────────────────

/** Fetch a user or organization profile. Works for both via GET /users/{login}. */
export function useProfile(login: string) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: profileKeys.user(login),
    enabled: !!token && !!login,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<GitHubProfile> => {
      const client = getGitHubClient();
      const res = await client.request("GET /users/{username}", { username: login });
      return GitHubProfileSchema.parse(res.data);
    },
  });
}

/** Fetch repositories for a user or org profile page. */
export function useProfileRepos(login: string, isOrg: boolean) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: profileKeys.repos(login),
    enabled: !!token && !!login,
    staleTime: 60_000,
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
}

/** Fetch organizations a user belongs to. */
export function useUserOrgs(login: string) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: profileKeys.orgs(login),
    enabled: !!token && !!login,
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
}

/** Fetch members of an organization. Requires authenticated org membership. */
export function useOrgMembers(org: string) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: profileKeys.members(org),
    enabled: !!token && !!org,
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
}
