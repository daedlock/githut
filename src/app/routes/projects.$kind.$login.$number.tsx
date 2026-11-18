import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { ProjectWorkspace } from "@/app/features/projects/ProjectWorkspace";
import { useAuthStore } from "@/app/stores/auth";
export const Route = createFileRoute("/projects/$kind/$login/$number")({
  beforeLoad: ({ params }) => {
    if (!useAuthStore.getState().token) throw redirect({ to: "/login" });
    if (!["users", "orgs"].includes(params.kind) || !/^\d+$/.test(params.number)) throw notFound();
  },
  validateSearch: z.object({ view: z.coerce.string().optional(), item: z.string().optional() }),
  component: Page,
});
function Page() {
  const p = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <ProjectWorkspace
      key={`${p.kind}/${p.login}/${p.number}`}
      kind={p.kind}
      login={p.login}
      number={Number(p.number)}
      {...search}
      change={(patch) => void navigate({ search: (prev) => ({ ...prev, ...patch }) })}
    />
  );
}
