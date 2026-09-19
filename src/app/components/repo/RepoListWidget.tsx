import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { RepoRow } from "@/app/components/repo/RepoRow";
import { Input } from "@/app/components/ui/input";
import { Skeleton, SkeletonGroup } from "@/app/components/ui/skeleton";
import { Widget } from "@/app/components/ui/Widget";
import { cn } from "@/app/lib/cn";
import type { RepoSummary } from "@/shared/types";

type GroupMode = "flat" | "owner";

export type RepoListWidgetProps = {
  repos: RepoSummary[] | undefined;
  isPending?: boolean;
  onRepoClick?: (repo: RepoSummary) => void;
};

export function RepoListWidget({ repos, isPending, onRepoClick }: RepoListWidgetProps) {
  const [query, setQuery] = useState("");
  const [groupMode, setGroupMode] = useState<GroupMode>("owner");

  const filtered = useMemo(() => {
    if (!repos) return [];
    const q = query.trim().toLowerCase();
    if (!q) return repos;
    return repos.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.fullName.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q),
    );
  }, [repos, query]);

  const grouped = useMemo(() => {
    if (groupMode === "flat") return null;
    const byOwner = new Map<string, RepoSummary[]>();
    for (const r of filtered) {
      const list = byOwner.get(r.owner.login) ?? [];
      list.push(r);
      byOwner.set(r.owner.login, list);
    }
    return [...byOwner.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered, groupMode]);

  return (
    <Widget
      title="Repositories"
      meta={repos ? `${filtered.length} / ${repos.length}` : undefined}
      actions={<GroupToggle value={groupMode} onChange={setGroupMode} />}
      bodyClassName="p-0"
    >
      <div className="border-b border-border px-4 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search repositories…"
            className="pl-8"
          />
        </div>
      </div>

      {isPending ? (
        <RepoRowsSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState label={query ? "No matches." : "No repositories."} />
      ) : groupMode === "flat" ? (
        <div className="flex flex-col">
          {filtered.map((r) => (
            <RepoRow key={r.id} repo={r} showOwner onClick={onRepoClick} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col">
          {grouped?.map(([owner, list]) => (
            <div key={owner}>
              <OwnerHeader owner={owner} count={list.length} />
              {list.map((r) => (
                <RepoRow key={r.id} repo={r} onClick={onRepoClick} />
              ))}
            </div>
          ))}
        </div>
      )}

    </Widget>
  );
}

function OwnerHeader({ owner, count }: { owner: string; count: number }) {
  return (
    <div className="flex items-baseline gap-2 bg-[var(--color-bg-sunken)]/50 px-4 py-1.5 font-mono text-micro uppercase tracking-widest text-muted-foreground">
      <span>{owner}</span>
      <span className="text-[var(--color-fg-faint)]">
        {count} {count === 1 ? "repo" : "repos"}
      </span>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="px-4 py-8 text-center font-mono text-ui text-[var(--color-fg-faint)]">
      {label}
    </div>
  );
}

function RepoRowsSkeleton({ rows }: { rows?: number } = {}) {
  // Mirrors a real RepoRow's proportions so the shift when data arrives is
  // near-zero. Widths vary per-row so the list feels organic.
  const all = [72, 58, 80, 46, 64, 70, 52, 66];
  const widths = rows ? all.slice(0, rows) : all;
  return (
    <SkeletonGroup label="Loading repositories" className="skeleton-fade flex flex-col">
      {widths.map((titleW) => (
        <div
          key={titleW}
          className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0"
        >
          <div className="min-w-0 flex-1 flex flex-col gap-1.5">
            <Skeleton className="h-3.5" style={{ width: `${titleW}%` }} />
            <Skeleton className="h-3" style={{ width: `${Math.min(90, titleW + 20)}%` }} />
          </div>
          <Skeleton className="hidden h-3 w-10 sm:block" />
          <Skeleton className="hidden h-3 w-16 md:block" />
        </div>
      ))}
    </SkeletonGroup>
  );
}

function GroupToggle({
  value,
  onChange,
}: {
  value: GroupMode;
  onChange: (next: GroupMode) => void;
}) {
  return (
    <div className="flex items-center gap-px">
      {(["owner", "flat"] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          className={cn(
            "h-6 px-2 rounded-sm font-sans text-caption font-medium",
            "outline-none focus-visible:ring-1 focus-visible:ring-(--color-focus)",
            value === mode
              ? "bg-(--color-bg-sunken) text-foreground"
              : "text-muted-foreground hover:bg-(--color-bg-sunken) hover:text-foreground",
          )}
        >
          {mode === "owner" ? "by org" : "flat"}
        </button>
      ))}
    </div>
  );
}
