import { CaretDown, MagnifyingGlass } from "@phosphor-icons/react";
import { RepoIcon } from "@primer/octicons-react";
import { useMemo, useState } from "react";
import { RepoRow } from "@/app/components/repo/RepoRow";
import { Input } from "@/app/components/ui/input";
import { Skeleton } from "@/app/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/app/components/ui/toggle-group";
import { cn } from "@/app/lib/cn";
import type { RepoSummary } from "@/shared/types";
import { ProfileSectionHeader } from "./ProfileSectionHeader";

const COLLAPSED_LIMIT = 8;

type SortKey = "recent" | "stars" | "name";

const SORTS: { id: SortKey; label: string }[] = [
  { id: "recent", label: "Recent" },
  { id: "stars", label: "Stars" },
  { id: "name", label: "Name" },
];

export type ProfileReposProps = {
  repos: RepoSummary[] | undefined;
  isLoading: boolean;
};

/**
 * The "all repositories" section. Header on the page surface, a mute-toned
 * toolbar for filter/sort, and a flat row list. When the list runs long
 * we collapse to the first N rows behind a gradient mask that fades into
 * the page background — a "View all N" button reveals the rest.
 */
export function ProfileRepos({ repos, isLoading }: ProfileReposProps) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [expanded, setExpanded] = useState(false);

  const filtered = useMemo(() => {
    if (!repos) return [];
    const q = query.trim().toLowerCase();
    const list = q
      ? repos.filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            r.description?.toLowerCase().includes(q) ||
            r.language?.toLowerCase().includes(q),
        )
      : [...repos];
    list.sort((a, b) => {
      if (sort === "stars") return b.stars - a.stars;
      if (sort === "name") return a.name.localeCompare(b.name);
      return new Date(b.pushedAt).getTime() - new Date(a.pushedAt).getTime();
    });
    return list;
  }, [repos, query, sort]);

  // When searching, ignore the collapse limit — users want to see all matches.
  const truncated = !expanded && !query && filtered.length > COLLAPSED_LIMIT;
  const visible = truncated ? filtered.slice(0, COLLAPSED_LIMIT) : filtered;

  return (
    <section className="flex flex-col gap-3">
      <ProfileSectionHeader
        title="All Repositories"
        count={repos ? (query ? filtered.length : repos.length) : undefined}
        icon={<RepoIcon className="size-3 text-(--color-fg-faint)" />}
      />

      <div className="flex flex-col gap-2 rounded-lg bg-muted px-2 py-1.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1">
          <MagnifyingGlass
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search repositories…"
            className="h-7 border-transparent bg-background pl-8 text-ui"
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-caption text-muted-foreground">Sort</span>
          <ToggleGroup
            type="single"
            value={sort}
            onValueChange={(value) => {
              if (value) setSort(value as SortKey);
            }}
            aria-label="Sort repositories"
            size="sm"
            className="rounded-md bg-background p-0.5"
          >
            {SORTS.map((s) => (
              <ToggleGroupItem
                key={s.id}
                value={s.id}
                aria-label={`Sort by ${s.label.toLowerCase()}`}
                className="h-6 rounded px-2 text-caption data-[state=on]:bg-muted"
              >
                {s.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>

      {isLoading ? (
        <RepoListSkeleton />
      ) : filtered.length === 0 ? (
        <div className="px-5 py-16 text-center text-body text-muted-foreground">
          {query ? (
            <>
              No repositories match <span className="text-foreground">"{query}"</span>.
            </>
          ) : (
            "No public repositories yet."
          )}
        </div>
      ) : (
        <div className="relative">
          <div className="flex flex-col gap-1">
            {visible.map((r) => (
              <RepoRow key={r.id} repo={r} />
            ))}
          </div>

          {truncated && (
            <>
              {/* Gradient mask — fades the last row into bg */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background via-background/85 to-transparent"
              />
            </>
          )}
        </div>
      )}

      {/* Toggle */}
      {!isLoading && !query && filtered.length > COLLAPSED_LIMIT && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            "group inline-flex items-center justify-center gap-1.5 self-center",
            "rounded-lg px-3 py-1.5 text-caption text-muted-foreground",
            "transition-colors hover:bg-muted hover:text-foreground",
          )}
        >
          {expanded ? "Collapse" : `Show all ${filtered.length} repositories`}
          <CaretDown
            className={cn("size-3.5 transition-transform", expanded && "rotate-180")}
            aria-hidden
          />
        </button>
      )}
    </section>
  );
}

function RepoListSkeleton() {
  const widths = [72, 58, 80, 46, 64];
  return (
    <div className="skeleton-fade flex flex-col gap-1">
      {widths.map((w) => (
        <div key={w} className="flex items-center gap-3 px-4 py-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5" style={{ width: `${w}%` }} />
            <Skeleton className="h-3" style={{ width: `${Math.min(90, w + 20)}%` }} />
          </div>
          <Skeleton className="hidden h-3 w-16 sm:block" />
        </div>
      ))}
    </div>
  );
}
