import { createFileRoute, redirect } from "@tanstack/react-router";
import { InboxPage } from "@/app/features/notifications/InboxPage";
import { useAuthStore } from "@/app/stores/auth";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (!useAuthStore.getState().token) throw redirect({ to: "/login" });
  },
  component: InboxPage,
});
