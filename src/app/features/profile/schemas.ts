import { z } from "zod";

// ─── User / Organization profile ───────────────────────────────────────────
// GET /users/{username} returns the same shape for both users and orgs.
// The `type` field disambiguates.

export const GitHubProfileSchema = z.object({
  login: z.string(),
  id: z.number(),
  avatar_url: z.string(),
  html_url: z.string(),
  type: z.enum(["User", "Organization"]),
  name: z.string().nullable(),
  company: z.string().nullable(),
  blog: z.string().nullable(),
  location: z.string().nullable(),
  email: z.string().nullable(),
  bio: z.string().nullable(),
  twitter_username: z.string().nullable(),
  public_repos: z.number(),
  followers: z.number(),
  following: z.number(),
  created_at: z.string(),
});

export type GitHubProfile = z.infer<typeof GitHubProfileSchema>;

// ─── Org members ───────────────────────────────────────────────────────────
// GET /orgs/{org}/members — requires org membership for the authenticated user.

export const OrgMemberSchema = z.object({
  login: z.string(),
  id: z.number(),
  avatar_url: z.string(),
  html_url: z.string(),
});

export type OrgMember = z.infer<typeof OrgMemberSchema>;

// ─── User's org memberships ────────────────────────────────────────────────
// GET /users/{username}/orgs

export const UserOrgSchema = z.object({
  login: z.string(),
  id: z.number(),
  avatar_url: z.string(),
  description: z.string().nullable(),
});

export type UserOrg = z.infer<typeof UserOrgSchema>;

// ─── Events ────────────────────────────────────────────────────────────────
// GET /users/{username}/events/public  or  GET /orgs/{org}/events.
// Used for the activity heatmap and the "Latest activity" widget.
// We accept the payload as opaque and pull out only the bits we render.

export const GitHubEventSchema = z.object({
  id: z.string(),
  type: z.string().nullable(),
  actor: z
    .object({
      login: z.string(),
      avatar_url: z.string().optional(),
    })
    .optional(),
  repo: z
    .object({
      id: z.number(),
      name: z.string(), // "owner/repo"
    })
    .optional(),
  payload: z.unknown().optional(),
  public: z.boolean().optional(),
  created_at: z.string().nullable(),
});

export type GitHubEvent = z.infer<typeof GitHubEventSchema>;

// ─── Repos from profile endpoints ──────────────────────────────────────────
// Same GitHub shape as useRepos; transformed to RepoSummary in the hook.

export const ProfileRepoSchema = z.object({
  id: z.number(),
  name: z.string(),
  full_name: z.string(),
  private: z.boolean(),
  description: z.string().nullable(),
  language: z.string().nullable(),
  stargazers_count: z.number(),
  pushed_at: z.string().nullable(),
  fork: z.boolean(),
  owner: z.object({
    login: z.string(),
    avatar_url: z.string(),
    type: z.enum(["User", "Organization"]),
  }),
});
