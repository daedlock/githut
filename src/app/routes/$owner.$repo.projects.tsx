import { createFileRoute } from "@tanstack/react-router";
import { ProjectsHome } from "@/app/features/projects/ProjectsHome";
export const Route = createFileRoute("/$owner/$repo/projects")({ component: RepositoryProjects });
function RepositoryProjects() {
  return <ProjectsHome repository={Route.useParams()} />;
}
