import type { DashboardCategory, RepoCount } from "@/app/features/dashboard/lib/filter";
import { cn } from "@/app/lib/cn";

// ─── DashboardSidebar ─────────────────────────────────────────────────────
//
// Two independent filter axes live here:
//
//   1. Category — which surface to look at: All / Review / Assigned /
//      Mentioned / Open PRs. Mutually exclusive (radio).
//   2. Repo — narrow to a single repo. Independent of category, so
//      "Review + alice/api" is expressible by selecting both.
//
// Same surface as the page (bg-background), per DESIGN.md. Separation from
// the main column comes from spacing, not a different background.

export type DashboardSidebarProps = {
  category: DashboardCategory;
  onCategoryChange: (next: DashboardCategory) => void;
  repo: string | null;
  onRepoChange: (next: string | null) => void;
  counts: Record<DashboardCategory, number | null>;
  repoCounts: RepoCount[];
};

type CategoryDef = {
  value: DashboardCategory;
  label: string;
  group: "inbox" | "awaiting" | "work";
};

const CATEGORIES: CategoryDef[] = [
  { value: "all", label: "All", group: "inbox" },
  { value: "review", label: "Review requested", group: "awaiting" },
  { value: "assigned", label: "Assigned", group: "awaiting" },
  { value: "mentioned", label: "Mentioned", group: "awaiting" },
  { value: "my-prs", label: "Open PRs", group: "work" },
];

const GROUP_LABELS: Record<CategoryDef["group"], string | null> = {
  inbox: null,
  awaiting: "Awaiting you",
  work: "Your work",
};

export function DashboardSidebar({
  category,
  onCategoryChange,
  repo,
  onRepoChange,
  counts,
  repoCounts,
}: DashboardSidebarProps) {
  const grouped: Array<{ group: CategoryDef["group"]; items: CategoryDef[] }> = [];
  let lastGroup: CategoryDef["group"] | null = null;
  for (const c of CATEGORIES) {
    if (c.group !== lastGroup) {
      grouped.push({ group: c.group, items: [] });
      lastGroup = c.group;
    }
    grouped[grouped.length - 1]!.items.push(c);
  }

  return (
    // Sidebar shares the page surface (bg-background, no chrome). On desktop
    // it sticks below the top nav; on mobile it stacks above the list content.
    <aside className="flex w-full shrink-0 flex-col gap-5 lg:sticky lg:top-16 lg:w-56 lg:pt-[52px] lg:pr-3">
      {grouped.map(({ group, items }) => {
        const heading = GROUP_LABELS[group];
        return (
          <nav key={group} aria-label={heading ?? "Inbox"} className="flex flex-col gap-0.5">
            {heading ? <SectionEyebrow label={heading} /> : null}
            {items.map((c) => (
              <CategoryButton
                key={c.value}
                label={c.label}
                count={counts[c.value] ?? null}
                selected={category === c.value}
                onClick={() => onCategoryChange(c.value)}
              />
            ))}
          </nav>
        );
      })}

      {repoCounts.length > 0 ? (
        <nav aria-label="Repos" className="flex flex-col gap-0.5">
          <SectionEyebrow label="Repos" />
          <CategoryButton
            label="All repos"
            count={null}
            selected={repo === null}
            onClick={() => onRepoChange(null)}
          />
          {repoCounts.map((r) => (
            <CategoryButton
              key={r.ownerRepo}
              label={r.ownerRepo}
              count={r.count}
              selected={repo === r.ownerRepo}
              onClick={() => onRepoChange(repo === r.ownerRepo ? null : r.ownerRepo)}
              mono
            />
          ))}
        </nav>
      ) : null}
    </aside>
  );
}

function SectionEyebrow({ label }: { label: string }) {
  return (
    <div className="mb-1.5 flex items-center gap-2 px-2">
      <span className="text-micro font-[475] text-(--color-fg-faint)">{label}</span>
      <span aria-hidden className="h-px flex-1 bg-border" />
    </div>
  );
}

function CategoryButton({
  label,
  count,
  selected,
  onClick,
  mono = false,
}: {
  label: string;
  count: number | null;
  selected: boolean;
  onClick: () => void;
  mono?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex h-7 items-center justify-between gap-2 rounded-md px-2",
        "outline-none transition-colors",
        "focus-visible:ring-1 focus-visible:ring-(--color-focus)",
        // Sidebar sits on bg-background. Hover/active rises ONE step to
        // bg-muted (the raised surface) — never to bg-accent (sunken),
        // which is too loud. Active state is bg-muted + typography
        // emphasis, so the row reads as selected without a heavy fill.
        selected
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-left text-ui",
          mono && "font-mono",
          selected && "font-[475]",
        )}
      >
        {label}
      </span>
      {count !== null ? (
        <span
          className={cn(
            "shrink-0 font-mono text-micro tabular-nums",
            selected ? "text-foreground" : "text-(--color-fg-faint)",
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}
