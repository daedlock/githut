import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/app/components/ui/card";
import { memberships, projectHref } from "./api";
import { ProjectError } from "./ProjectsHome";
export function Memberships({
  owner,
  repo,
  number,
}: {
  owner: string;
  repo: string;
  number: number;
}) {
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ["projects", "memberships", owner, repo, number],
    enabled: open,
    queryFn: () => memberships(owner, repo, number),
  });
  return (
    <Card variant="muted" className="p-3">
      <details onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary className="cursor-pointer text-ui">Projects</summary>
        {q.error ? (
          <ProjectError error={q.error} retry={() => q.refetch()} />
        ) : q.isPending ? (
          <p>Loading…</p>
        ) : q.data?.length ? (
          q.data.map((m) => (
            <Link
              className="mt-2 block text-ui"
              key={m.id}
              to={projectHref(m.project)}
              search={{ item: m.id }}
            >
              {m.project.title} · {m.isArchived ? "Archived" : (m.status?.name ?? "No status")}
            </Link>
          ))
        ) : (
          <p className="text-caption">No project memberships.</p>
        )}
      </details>
    </Card>
  );
}
