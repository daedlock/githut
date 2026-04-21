import type { RepoSummary } from "@/shared/types";
import type { GitHubProfile, OrgMember, UserOrg } from "../schemas";

/**
 * Shared data contract for all profile layout variants.
 *
 * Both user and org profiles pipe through the same props — layouts
 * branch on `profile.type` internally when they need to decide between
 * "orgs" (for users) vs "members" (for orgs).
 */
export type ProfileLayoutProps = {
  login: string;
  profile: GitHubProfile | undefined;
  profileLoading: boolean;
  repos: RepoSummary[] | undefined;
  reposLoading: boolean;
  readme: string | null | undefined;
  readmeLoading: boolean;
  /** Present for users only. */
  orgs?: UserOrg[];
  orgsLoading?: boolean;
  /** Present for orgs only. */
  members?: OrgMember[];
  membersLoading?: boolean;
  onRepoClick: (repo: RepoSummary) => void;
};
