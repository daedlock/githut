import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { RepoRow } from "@/app/components/repo/RepoRow";
import { Input } from "@/app/components/ui/Input";
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
      <div className="border-b border-[var(--color-border)] px-4 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-fg-faint)]" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search repositories…"
            className="pl-8"
          />
        </div>
      </div>

      {isPending ? (
        <EmptyState label="Loading repositories…" />
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
    <div className="flex items-baseline gap-2 bg-[var(--color-bg-sunken)]/50 px-4 py-1.5 font-mono text-[10px] uppercase tracking-widest text-[var(--color-fg-muted)]">
      <span>{owner}</span>
      <span className="text-[var(--color-fg-faint)]">
        {count} {count === 1 ? "repo" : "repos"}
      </span>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="px-4 py-8 text-center font-mono text-xs text-[var(--color-fg-faint)]">
      {label}
    </div>
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
    <div className="flex items-center rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] p-0.5">
      {(["owner", "flat"] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          className={cn(
            "h-5 px-2 font-mono text-[10px] uppercase tracking-widest transition-colors",
            value === mode
              ? "bg-[var(--color-fg)] text-[var(--color-bg)]"
              : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]",
          )}
        >
          {mode === "owner" ? "by org" : "flat"}
        </button>
      ))}
    </div>
  );
}
