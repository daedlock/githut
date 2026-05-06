import { createFileRoute, redirect } from "@tanstack/react-router";
import { AppShell } from "@/app/components/shell/AppShell";
import { UnifiedNav } from "@/app/components/shell/UnifiedNav";
import { profileQueryOptions } from "@/app/features/profile/hooks";
import { ProfileView } from "@/app/features/profile/ProfileView";
import { useAuthStore } from "@/app/stores/auth";

export const Route = createFileRoute("/$username")({
  beforeLoad: () => {
    if (!useAuthStore.getState().token) throw redirect({ to: "/login" });
  },
  // Non-blocking prefetch for the profile itself. Type-branched queries
  // (repos, readme, orgs/members) need the profile's `type` field to
  // decide user-vs-org path, so they're kicked off from inside the
  // component once the profile resolves. ProfileView renders skeletons
  // while data is loading.
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(profileQueryOptions(params.username));
  },
  component: ProfilePage,
});

function ProfilePage() {
  const { username } = Route.useParams();
  return (
    <AppShell header={<UnifiedNav />}>
      <ProfileView login={username} />
    </AppShell>
  );
}
