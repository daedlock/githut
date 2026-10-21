import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { InboxPage } from "@/app/features/notifications/InboxPage";
import { useAuthStore } from "@/app/stores/auth";

const searchSchema = z.object({
  view: z.enum(["all", "work"]).optional().catch(undefined),
  // Inbox filters; see features/notifications/filters.ts for the format.
  repo: z.string().optional().catch(undefined),
  type: z.string().optional().catch(undefined),
  who: z.enum(["mine", "team"]).optional().catch(undefined),
});

export const Route = createFileRoute("/")({
  validateSearch: searchSchema,
  beforeLoad: () => {
    if (!useAuthStore.getState().token) throw redirect({ to: "/login" });
  },
  component: Home,
});

function Home() {
  const { view, ...filters } = Route.useSearch();
  return <InboxPage view={view} filters={filters} />;
}
