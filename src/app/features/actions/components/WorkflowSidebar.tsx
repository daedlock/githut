import { Link } from "@tanstack/react-router";
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

// ─── Workflows sidebar ─────────────────────────────────────────────────────
//
// Matches the current dashboard sidebar vocabulary: page-surface sidebar,
// small section label with a rule, and muted selected rows. No mono-caps
// section block and no brand rail — Actions should read like the rest of
// the app's list/navigation surfaces.

export function WorkflowSidebar({
  owner,
  repo,
  workflows,
  isPending,
  selectedId,
}: WorkflowSidebarProps) {
  const all = workflows ?? [];
  const activeCount = all.filter((w) => w.state === "active").length;

  // Active first (alpha), disabled grouped below.
  const sorted = [...all].sort((a, b) => {
    const aActive = a.state === "active" ? 0 : 1;
    const bActive = b.state === "active" ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    return a.name.localeCompare(b.name);
  });

  return (
    <aside aria-label="Workflows" className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 px-2">
        <span className="text-micro font-[475] text-(--color-fg-faint)">Workflows</span>
        <span aria-hidden className="h-px flex-1 bg-border" />
        {!isPending ? (
          <span className="font-mono text-micro tabular-nums text-(--color-fg-faint)">
            {activeCount}
          </span>
        ) : null}
      </div>

      <nav className="flex flex-col">
        <WorkflowRow
          owner={owner}
          repo={repo}
          label="All workflows"
          search={{}}
          isActive={selectedId === null}
          disabled={false}
        />

        {isPending ? (
          <SidebarSkeleton />
        ) : (
          sorted.map((w) => (
            <WorkflowRow
              key={w.id}
              owner={owner}
              repo={repo}
              label={w.name}
              search={{ workflow: w.id }}
              isActive={selectedId === w.id}
              disabled={w.state !== "active"}
            />
          ))
        )}

        {!isPending && sorted.length === 0 ? (
          <p className="py-2 font-sans text-caption text-(--color-fg-faint)">No workflows yet.</p>
        ) : null}
      </nav>
    </aside>
  );
}

// ─── Row ───────────────────────────────────────────────────────────────────

function WorkflowRow({
  owner,
  repo,
  label,
  search,
  isActive,
  disabled,
}: {
  owner: string;
  repo: string;
  label: string;
  search: { workflow?: number };
  isActive: boolean;
  disabled: boolean;
}) {
  return (
    <Link
      to="/$owner/$repo/actions"
      params={{ owner, repo }}
      search={search}
      className={cn(
        "group flex h-7 items-center rounded-md px-2",
        "text-ui font-sans outline-none transition-colors",
        isActive
          ? "bg-muted text-foreground font-[475]"
          : disabled
            ? "text-(--color-fg-faint) hover:bg-muted hover:text-muted-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        "focus-visible:bg-muted focus-visible:text-foreground",
      )}
      aria-current={isActive ? "page" : undefined}
      title={disabled ? `${label} (disabled)` : label}
    >
      <span className="truncate">{label}</span>
    </Link>
  );
}

// ─── Bits ──────────────────────────────────────────────────────────────────

function SidebarSkeleton() {
  const widths = [62, 78, 54, 72, 68];
  return (
    <div className="flex flex-col gap-2 py-2 pl-2">
      {widths.map((w) => (
        <Skeleton key={w} className="h-3" style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}
