import { createFileRoute, redirect } from "@tanstack/react-router";
import { AppShell } from "@/app/components/shell/AppShell";
import { ShellFooter } from "@/app/components/shell/ShellFooter";
import { TopBar } from "@/app/components/shell/TopBar";
import {
  orgMembersQueryOptions,
  profileQueryOptions,
  profileReadmeQueryOptions,
  profileReposQueryOptions,
  userOrgsQueryOptions,
} from "@/app/features/profile/hooks";
import { ProfileView } from "@/app/features/profile/ProfileView";
import { useAuthStore } from "@/app/stores/auth";

export const Route = createFileRoute("/$username")({
  beforeLoad: () => {
    if (!useAuthStore.getState().token) throw redirect({ to: "/login" });
  },
  loader: async ({ context, params }) => {
    const qc = context.queryClient;
    // Profile must resolve first — everything else branches on user-vs-org.
    const profile = await qc.ensureQueryData(profileQueryOptions(params.username));
    const isOrg = profile.type === "Organization";
    await Promise.all([
      qc.prefetchQuery(profileReposQueryOptions(params.username, isOrg)),
      qc.prefetchQuery(profileReadmeQueryOptions(params.username, isOrg)),
      isOrg
        ? qc.prefetchQuery(orgMembersQueryOptions(params.username))
        : qc.prefetchQuery(userOrgsQueryOptions(params.username)),
    ]);
  },
  component: ProfilePage,
});

function ProfilePage() {
  const { username } = Route.useParams();
  return (
    <AppShell
      header={<TopBar bordered />}
      footer={<ShellFooter bordered origin="localhost:5173" />}
    >
      <ProfileView login={username} />
    </AppShell>
  );
}
