import { createFileRoute, redirect } from "@tanstack/react-router";
import { AppShell } from "@/app/components/shell/AppShell";
import { ShellFooter } from "@/app/components/shell/ShellFooter";
import { TopBar } from "@/app/components/shell/TopBar";
import { StatusMessage } from "@/app/components/StatusMessage";
import { Container } from "@/app/components/ui/Container";
import { useProfile } from "@/app/features/profile/hooks";
import { OrgProfile } from "@/app/features/profile/OrgProfile";
import { UserProfile } from "@/app/features/profile/UserProfile";
import { useAuthStore } from "@/app/stores/auth";

export const Route = createFileRoute("/$username")({
  beforeLoad: () => {
    if (!useAuthStore.getState().token) throw redirect({ to: "/login" });
  },
  component: ProfilePage,
});

function ProfilePage() {
  const { username } = Route.useParams();
  const { data: profile, isError } = useProfile(username);

  return (
    <AppShell
      header={<TopBar bordered />}
      footer={<ShellFooter bordered origin="localhost:5173" />}
    >
      {isError ? (
        <Container className="py-8">
          <StatusMessage tone="danger">User or organization not found.</StatusMessage>
        </Container>
      ) : profile?.type === "Organization" ? (
        <OrgProfile login={username} />
      ) : (
        <UserProfile login={username} />
      )}
    </AppShell>
  );
}
