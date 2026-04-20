import { useNavigate } from "@tanstack/react-router";
import { StatusMessage } from "@/app/components/StatusMessage";
import { Container } from "@/app/components/ui/Container";
import { useProfile, useProfileRepos, useUserOrgs } from "./hooks";
import { OrgAvatarGroup } from "./components/OrgAvatarGroup";
import { ProfileHeader } from "./components/ProfileHeader";
import { ProfileMeta } from "./components/ProfileMeta";
import { ProfileRepoList } from "./components/ProfileRepoList";

export type UserProfileProps = {
  login: string;
};

export function UserProfile({ login }: UserProfileProps) {
  const profile = useProfile(login);
  const repos = useProfileRepos(login, false);
  const orgs = useUserOrgs(login);
  const navigate = useNavigate();

  if (profile.isError) {
    return (
      <Container className="py-8">
        <StatusMessage tone="danger">Could not load this profile.</StatusMessage>
      </Container>
    );
  }

  return (
    <Container className="py-6 sm:py-8">
      <div className="flex flex-col gap-6">
        <ProfileHeader profile={profile.data} isLoading={profile.isPending} />

        {profile.data && <ProfileMeta profile={profile.data} />}

        <div className="flex flex-col gap-5 border-t border-border pt-5">
          <OrgAvatarGroup orgs={orgs.data} isLoading={orgs.isPending} />

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
