import { useNavigate } from "@tanstack/react-router";
import { StatusMessage } from "@/app/components/StatusMessage";
import { Container } from "@/app/components/ui/Container";
import { useProfileLayoutStore } from "@/app/stores/profileLayout";
import type { RepoSummary } from "@/shared/types";
import { LayoutPicker } from "./components/LayoutPicker";
import {
  useOrgMembers,
  useProfile,
  useProfileReadme,
  useProfileRepos,
  useUserOrgs,
} from "./hooks";
import { ClassicLayout } from "./layouts/ClassicLayout";
import { DossierLayout } from "./layouts/DossierLayout";
import { EditorialLayout } from "./layouts/EditorialLayout";
import { GridLayout } from "./layouts/GridLayout";
import type { ProfileLayoutProps } from "./layouts/types";

/**
 * Unified profile page — handles both users and organizations. Fetches all
 * the data up front (profile, repos, readme, and either orgs-for-user or
 * members-for-org), then delegates rendering to the currently-selected
 * layout variant.
 *
 * The layout picker strip sits above the content and persists the choice.
 */
export function ProfileView({ login }: { login: string }) {
  const navigate = useNavigate();
  const layoutId = useProfileLayoutStore((s) => s.layoutId);

  const profile = useProfile(login);
  const isOrg = profile.data?.type === "Organization";

  const repos = useProfileRepos(login, !!isOrg);
  const readme = useProfileReadme(login, isOrg);
  const orgs = useUserOrgs(profile.data && !isOrg ? login : "");
  const members = useOrgMembers(profile.data && isOrg ? login : "");

  const onRepoClick = (repo: RepoSummary) =>
    navigate({
      to: "/$owner/$repo",
      params: { owner: repo.owner.login, repo: repo.name },
    });

  if (profile.isError) {
    return (
      <>
        <LayoutPicker />
        <Container className="py-8">
          <StatusMessage tone="danger">User or organization not found.</StatusMessage>
        </Container>
      </>
    );
  }

  const shared: ProfileLayoutProps = {
    login,
    profile: profile.data,
    profileLoading: profile.isPending,
    repos: repos.data,
    reposLoading: repos.isPending,
    readme: readme.data,
    readmeLoading: readme.isPending,
    orgs: isOrg ? undefined : orgs.data,
    orgsLoading: isOrg ? undefined : orgs.isPending,
    members: isOrg ? members.data : undefined,
    membersLoading: isOrg ? members.isPending : undefined,
    onRepoClick,
  };

  return (
    <>
      <LayoutPicker />
      {layoutId === "classic" && <ClassicLayout {...shared} />}
      {layoutId === "dossier" && <DossierLayout {...shared} />}
      {layoutId === "editorial" && <EditorialLayout {...shared} />}
      {layoutId === "grid" && <GridLayout {...shared} />}
    </>
  );
}
