import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { InboxPage } from "@/app/features/notifications/InboxPage";
import { useAuthStore } from "@/app/stores/auth";

const searchSchema = z.object({ view: z.enum(["work"]).optional().catch(undefined) });

export const Route = createFileRoute("/")({
  validateSearch: searchSchema,
  beforeLoad: () => {
    if (!useAuthStore.getState().token) throw redirect({ to: "/login" });
  },
  component: Home,
});

function Home() {
  const { view } = Route.useSearch();
  return <InboxPage view={view} />;
}
