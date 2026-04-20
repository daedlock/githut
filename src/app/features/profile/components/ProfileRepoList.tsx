import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { RepoRow } from "@/app/components/repo/RepoRow";
import { Input } from "@/app/components/ui/input";
import { Skeleton } from "@/app/components/ui/skeleton";
import { Widget } from "@/app/components/ui/Widget";
import type { RepoSummary } from "@/shared/types";

export type ProfileRepoListProps = {
  repos: RepoSummary[] | undefined;
  isPending: boolean;
  onRepoClick?: (repo: RepoSummary) => void;
};

export function ProfileRepoList({ repos, isPending, onRepoClick }: ProfileRepoListProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!repos) return [];
    const q = query.trim().toLowerCase();
    if (!q) return repos;
    return repos.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q) ||
        r.language?.toLowerCase().includes(q),
    );
  }, [repos, query]);

  return (
    <Widget
      title="Repositories"
      meta={repos ? `${filtered.length} / ${repos.length}` : undefined}
      bodyClassName="p-0"
    >
      <div className="border-b border-border px-4 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter repositories…"
            className="pl-8"
          />
        </div>
      </div>

      {isPending ? (
        <RepoListSkeleton />
      ) : filtered.length === 0 ? (
        <div className="px-4 py-8 text-center font-mono text-ui text-(--color-fg-faint)">
          {query ? "No matches." : "No repositories."}
        </div>
      ) : (
        <div className="flex flex-col">
          {filtered.map((r) => (
            <RepoRow key={r.id} repo={r} onClick={onRepoClick} />
          ))}
        </div>
      )}
    </Widget>
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
