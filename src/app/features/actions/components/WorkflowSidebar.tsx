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
// Matches the `RepoAbout` sidebar feel on the Code page: a quiet eyebrow
// label, a hairline under it, and then content rows with no chrome of
// their own — the list should *breathe* against the page, not sit on top
// of it as button-backed rows.
//
// Active signalling uses DESIGN.md's nav recipe ("Active nav item: left
// accent border `border-l-2 border-l-(--color-accent)`") — the ember rail
// alone, no background fill. Hover shifts only text color.

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
    <aside aria-label="Workflows" className="sticky top-6 flex flex-col gap-2">
      {/* Eyebrow — matches RepoAbout "ABOUT"/"LANGUAGES" vocabulary */}
      <div className="flex items-baseline justify-between">
        <h3 className="font-mono text-micro font-medium uppercase tracking-widest text-muted-foreground">
          Workflows
        </h3>
        {!isPending ? (
          <span className="font-mono text-micro tabular-nums text-(--color-fg-faint)">
            {activeCount}
          </span>
        ) : null}
      </div>

      {/* Hairline under the eyebrow — the one structural mark */}
      <div aria-hidden className="h-px bg-border" />

      <nav
        className={cn(
          "flex flex-col",
          // Scroll independently so 50 workflows don't stretch the page.
          "max-h-[calc(100vh-8rem)] overflow-y-auto",
        )}
      >
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
          <p className="py-2 font-sans text-caption text-(--color-fg-faint)">
            No workflows yet.
          </p>
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
        // Ember rail is the only row chrome. border-l-2 at rest keeps
        // layout stable when activation flips the color.
        "group flex h-7 items-center py-1 pl-2 border-l-2 border-l-transparent",
        "text-ui font-sans outline-none",
        // No row background — hover shifts only the text color, matching
        // the RepoAbout quietness.
        isActive
          ? "border-l-(--color-accent) text-foreground font-medium"
          : disabled
            ? "text-(--color-fg-faint) hover:text-muted-foreground"
            : "text-muted-foreground hover:text-foreground",
        "focus-visible:text-foreground",
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
