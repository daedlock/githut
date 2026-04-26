import { ChevronDown, FolderGit2, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { RepoRow } from "@/app/components/repo/RepoRow";
import { Input } from "@/app/components/ui/input";
import { Skeleton } from "@/app/components/ui/skeleton";
import { cn } from "@/app/lib/cn";
import type { RepoSummary } from "@/shared/types";

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
  onRepoClick?: (repo: RepoSummary) => void;
};

/**
 * The "all repositories" section. Header on the page surface, a mute-toned
 * toolbar for filter/sort, and a flat row list. When the list runs long
 * we collapse to the first N rows behind a gradient mask that fades into
 * the page background — a "View all N" button reveals the rest.
 */
export function ProfileRepos({ repos, isLoading, onRepoClick }: ProfileReposProps) {
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
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="flex items-baseline gap-2 font-mono text-micro uppercase tracking-widest text-muted-foreground">
          <FolderGit2
            className="size-3 self-center text-[color:var(--color-fg-faint)]"
            aria-hidden
          />
          All repositories
          {repos && (
            <span className="font-mono text-micro tabular-nums text-[color:var(--color-fg-faint)]">
              {query ? `${filtered.length} / ${repos.length}` : repos.length}
            </span>
          )}
        </h2>
      </header>

      {/* Toolbar — bg-muted, rounded, compact */}
      <div className="flex flex-col gap-2 rounded-lg bg-muted p-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name, description, or language…"
            className="border-transparent bg-background pl-8"
          />
        </div>
        <div
          role="tablist"
          aria-label="Sort repositories"
          className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-background p-0.5"
        >
          {SORTS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={sort === s.id}
              onClick={() => setSort(s.id)}
              className={cn(
                "rounded-[5px] px-2.5 py-1 font-mono text-caption leading-none transition-colors",
                sort === s.id
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <RepoListSkeleton />
      ) : filtered.length === 0 ? (
        <div className="rounded-lg bg-muted/40 px-4 py-12 text-center font-mono text-ui text-muted-foreground">
          {query ? (
            <>
              No repositories match{" "}
              <span className="text-foreground">"{query}"</span>.
            </>
          ) : (
            "No public repositories yet."
          )}
        </div>
      ) : (
        <div className="relative">
          <div className="flex flex-col">
            {visible.map((r) => (
              <RepoRow key={r.id} repo={r} onClick={onRepoClick} />
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
            "rounded-md px-3 py-1.5 font-mono text-caption text-muted-foreground",
            "transition-colors hover:bg-muted hover:text-foreground",
          )}
        >
          {expanded
            ? "Collapse"
            : `Show all ${filtered.length} repositories`}
          <ChevronDown
            className={cn(
              "size-3.5 transition-transform",
              expanded && "rotate-180",
            )}
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
    <div className="flex flex-col">
      {widths.map((w, i) => (
        <div
          key={i}
          className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0"
        >
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
