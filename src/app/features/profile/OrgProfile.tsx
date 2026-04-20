import { useNavigate } from "@tanstack/react-router";
import { StatusMessage } from "@/app/components/StatusMessage";
import { Container } from "@/app/components/ui/Container";
import { useOrgMembers, useProfile, useProfileRepos } from "./hooks";
import { MemberGrid } from "./components/MemberGrid";
import { ProfileHeader } from "./components/ProfileHeader";
import { ProfileMeta } from "./components/ProfileMeta";
import { ProfileRepoList } from "./components/ProfileRepoList";

export type OrgProfileProps = {
  login: string;
};

export function OrgProfile({ login }: OrgProfileProps) {
  const profile = useProfile(login);
  const repos = useProfileRepos(login, true);
  const members = useOrgMembers(login);
  const navigate = useNavigate();

  if (profile.isError) {
    return (
      <Container className="py-8">
        <StatusMessage tone="danger">Could not load this organization.</StatusMessage>
      </Container>
    );
  }

  return (
    <Container className="py-6 sm:py-8">
      <div className="flex flex-col gap-6">
        <ProfileHeader profile={profile.data} isLoading={profile.isPending} />

        {profile.data && <ProfileMeta profile={profile.data} />}

        <div className="flex flex-col gap-5 border-t border-border pt-5">
          <MemberGrid
            members={members.data}
            isLoading={members.isPending}
            isError={members.isError}
          />

          <ProfileRepoList
            repos={repos.data}
            isPending={repos.isPending}
            onRepoClick={(repo) =>
              navigate({
                to: "/$owner/$repo",
                params: { owner: repo.owner.login, repo: repo.name },
              })
            }
          />
        </div>
      </div>
    </Container>
  );
}
