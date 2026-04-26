import { cn } from "@/app/lib/cn";
import type { DashboardCategory, RepoCount } from "@/app/features/dashboard/lib/filter";

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
// the main column comes from a single hairline + spacing, not from a
// different background. Section eyebrows use the mono micro token so
// nothing competes with the category labels themselves.

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
    // Sidebar shares the page surface (bg-background, no chrome) and sticks
    // below the top nav. DESIGN.md: sidebars use the SAME surface as the
    // page; separation comes from spacing, not from a different bg or a
    // border. The raised main panel sits next to us at bg-muted — that
    // contrast is enough.
    <aside
      className="sticky top-[44px] flex h-[calc(100vh-44px)] w-56 shrink-0 flex-col gap-5 overflow-y-auto py-6 pr-3"
    >
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
            mono
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
    <div className="mb-1 px-2 font-mono text-micro uppercase tracking-widest text-(--color-fg-faint)">
      {label}
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
