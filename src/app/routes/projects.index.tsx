import { createFileRoute, redirect } from "@tanstack/react-router";
import { ProjectsHome } from "@/app/features/projects/ProjectsHome";
import { useAuthStore } from "@/app/stores/auth";
export const Route = createFileRoute("/projects/")({
  beforeLoad: () => {
    if (!useAuthStore.getState().token) throw redirect({ to: "/login" });
  },
  component: ProjectsHome,
});
