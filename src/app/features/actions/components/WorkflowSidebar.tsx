import { Link } from "@tanstack/react-router";
import { Workflow as WorkflowIcon } from "lucide-react";
import { Skeleton } from "@/app/components/ui/skeleton";
import type { Workflow } from "@/app/features/actions/schemas";
import { cn } from "@/app/lib/cn";

export type WorkflowSidebarProps = {
  owner: string;
  repo: string;
  workflows: Workflow[] | undefined;
  isPending: boolean;
  /** Selected workflow id from URL search params, or `null` for "All workflows". */
  selectedId: number | null;
};

/**
 * Left rail listing the repo's workflows. Selecting one filters the runs
 * list via the `workflow` search param. "All workflows" is the implicit
 * first entry — wired as a <Link> with `search: {}` to clear the filter.
 */
export function WorkflowSidebar({
  owner,
  repo,
  workflows,
  isPending,
  selectedId,
}: WorkflowSidebarProps) {
  return (
    <nav
      aria-label="Workflows"
      className="flex w-56 flex-shrink-0 flex-col gap-0.5 border-r border-border pr-3"
    >
      <h2 className="px-2 py-1 font-mono text-micro uppercase tracking-widest text-muted-foreground">
        Workflows
      </h2>

      <SidebarLink
        owner={owner}
        repo={repo}
        label="All workflows"
        search={{}}
        isActive={selectedId === null}
      />

      {isPending ? (
        <SidebarSkeleton />
      ) : workflows && workflows.length > 0 ? (
        workflows
          .filter((w) => w.state === "active")
          .map((w) => (
            <SidebarLink
              key={w.id}
              owner={owner}
              repo={repo}
              label={w.name}
              search={{ workflow: w.id }}
              isActive={selectedId === w.id}
            />
          ))
      ) : (
        <p className="px-2 py-3 font-mono text-caption text-(--color-fg-faint)">
          No workflows.
        </p>
      )}
    </nav>
  );
}

function SidebarLink({
  owner,
  repo,
  label,
  search,
  isActive,
}: {
  owner: string;
  repo: string;
  label: string;
  search: { workflow?: number };
  isActive: boolean;
}) {
  return (
    <Link
      to="/$owner/$repo/actions"
      params={{ owner, repo }}
      search={search}
      className={cn(
        "flex items-center gap-2 rounded-sm px-2 py-1.5 text-ui outline-none",
        "transition-colors",
        "hover:bg-(--color-bg-sunken) focus-visible:bg-(--color-bg-sunken)",
        isActive ? "bg-(--color-bg-sunken) text-foreground" : "text-muted-foreground",
      )}
      aria-current={isActive ? "page" : undefined}
    >
      <WorkflowIcon
        className={cn(
          "size-3.5 flex-shrink-0",
          isActive ? "text-(--color-accent)" : "text-(--color-fg-faint)",
        )}
      />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function SidebarSkeleton() {
  const widths = [80, 60, 90, 70];
  return (
    <div className="flex flex-col gap-0.5 px-2 py-1">
      {widths.map((w) => (
        <Skeleton key={w} className="h-5" style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}
