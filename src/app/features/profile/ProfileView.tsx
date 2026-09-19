import { StatusMessage } from "@/app/components/StatusMessage";
import { Container } from "@/app/components/ui/Container";
import { ProfileActivity } from "./components/ProfileActivity";
import { ProfileBento } from "./components/ProfileBento";
import { ProfileHero } from "./components/ProfileHero";
import { ProfileLanguages } from "./components/ProfileLanguages";
import { ProfileLatestActivity } from "./components/ProfileLatestActivity";
import { ProfilePinned } from "./components/ProfilePinned";
import { ProfileReadme } from "./components/ProfileReadme";
import { ProfileRepos } from "./components/ProfileRepos";
import { ProfileRoster } from "./components/ProfileRoster";
import {
  useOrgMembers,
  useProfile,
  useProfileReadme,
  useProfileRepos,
  useUserEvents,
  useUserOrgs,
} from "./hooks";

/**
 * Profile dashboard — works for both Users and Organizations.
 *
 * Reading order, top to bottom:
 *   1. Hero            — who they are (compact identity + meta)
 *   2. Activity        — public-events heatmap, last 13 weeks
 *   3. Bento           — 4 stat tiles (repos / stars / followers / following)
 *   4. Languages +     — what they build with
 *      Latest activity   most recent public events
 *   5. README          — long-form intro (collapsed under a gradient mask)
 *   6. Top repos       — best-of pinned cards
 *   7. All repos       — filterable list, also masked-and-collapsed
 *   8. Roster          — orgs (user) or members (org)
 *
 * Uses the same saved container width as the navigation and other pages.
 * Surfaces win — the only borders in this layout are inside form inputs.
 */
export function ProfileView({ login }: { login: string }) {
  const profile = useProfile(login);
  const isOrg = profile.data ? profile.data.type === "Organization" : undefined;

  const repos = useProfileRepos(login, isOrg);
  const readme = useProfileReadme(login, isOrg);
  const events = useUserEvents(login, isOrg);
  const orgs = useUserOrgs(profile.data && !isOrg ? login : "");
  const members = useOrgMembers(profile.data && isOrg ? login : "");

  if (profile.isError) {
    return (
      <Container className="py-12">
        <StatusMessage tone="danger">User or organization not found.</StatusMessage>
      </Container>
    );
  }

  return (
    <Container className="py-8 sm:py-10">
      <div className="flex flex-col gap-10">
        <ProfileHero profile={profile.data} isLoading={profile.isPending} />

        <ProfileActivity events={events.data} isLoading={events.isPending} />

        <ProfileBento
          profile={profile.data}
          repos={repos.data}
          isLoading={profile.isPending || repos.isPending}
          membersCount={isOrg ? members.data?.length : undefined}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ProfileLanguages repos={repos.data} isLoading={repos.isPending} />
          <ProfileLatestActivity events={events.data} isLoading={events.isPending} />
        </div>

        <ProfileReadme
          login={login}
          isOrg={!!isOrg}
          markdown={readme.data}
          isLoading={readme.isPending}
        />

        <ProfilePinned repos={repos.data} isLoading={repos.isPending} />

        <ProfileRepos repos={repos.data} isLoading={repos.isPending} />

        <ProfileRoster
          isOrg={!!isOrg}
          orgs={isOrg ? undefined : orgs.data}
          orgsLoading={isOrg ? false : orgs.isPending}
          members={isOrg ? members.data : undefined}
          membersLoading={isOrg ? members.isPending : false}
        />
      </div>
    </Container>
  );
}
