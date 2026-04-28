import { CodeIcon } from "@primer/octicons-react";
import { useMemo } from "react";
import { Skeleton } from "@/app/components/ui/skeleton";
import type { RepoSummary } from "@/shared/types";
import { ProfileSectionHeader } from "./ProfileSectionHeader";

const SLOT_VARS = [
  "var(--chart-slot-1)",
  "var(--chart-slot-2)",
  "var(--chart-slot-3)",
  "var(--chart-slot-4)",
  "var(--chart-slot-5)",
  "var(--chart-slot-6)",
];

const slotColor = (i: number) => SLOT_VARS[i] ?? "var(--chart-other)";

export type ProfileLanguagesProps = {
  repos: RepoSummary[] | undefined;
  isLoading: boolean;
};

/**
 * Stacked language bar derived from repo metadata. Uses the same chart
 * slot tokens as the rest of the app so it picks up the active palette.
 */
export function ProfileLanguages({ repos, isLoading }: ProfileLanguagesProps) {
  const shares = useMemo(() => {
    if (!repos) return [];
    const counts = new Map<string, number>();
    for (const r of repos) {
      if (!r.language) continue;
      counts.set(r.language, (counts.get(r.language) ?? 0) + 1);
    }
    const total = [...counts.values()].reduce((s, n) => s + n, 0);
    if (total === 0) return [];
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count, pct: (count / total) * 100 }))
      .sort((a, b) => b.count - a.count);
  }, [repos]);

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-muted px-4 py-4 sm:px-5 sm:py-5">
      <ProfileSectionHeader
        title="Languages"
        icon={<CodeIcon className="size-3 text-[color:var(--color-fg-faint)]" />}
      />

      {isLoading ? (
        <LanguagesSkeleton />
      ) : shares.length === 0 ? (
        <p className="py-2 text-center text-caption text-(--color-fg-faint)">No language data</p>
      ) : (
        <Breakdown shares={shares} />
      )}
    </section>
  );
}

function Breakdown({ shares }: { shares: { name: string; count: number; pct: number }[] }) {
  const top = shares.slice(0, 5);
  const otherPct = shares.slice(5).reduce((s, l) => s + l.pct, 0);
  const otherCount = shares.slice(5).reduce((s, l) => s + l.count, 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-2 w-full gap-px overflow-hidden rounded-full">
        {top.map((l, i) => (
          <div
            key={l.name}
            title={`${l.name} · ${l.pct.toFixed(1)}%`}
            style={{ width: `${l.pct}%`, backgroundColor: slotColor(i) }}
          />
        ))}
        {otherPct > 0 && (
          <div
            title={`Other · ${otherPct.toFixed(1)}%`}
            style={{ width: `${otherPct}%`, backgroundColor: "var(--chart-other)" }}
          />
        )}
      </div>

      <ul className="flex flex-col gap-1.5">
        {top.map((l, i) => (
          <li key={l.name} className="flex items-baseline justify-between gap-2 text-caption">
            <span className="inline-flex min-w-0 items-center gap-2">
              <span
                aria-hidden
                className="inline-block size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: slotColor(i) }}
              />
              <span className="truncate font-mono text-foreground">{l.name}</span>
            </span>
            <span className="font-mono tabular-nums text-muted-foreground">
              {l.pct.toFixed(0)}%<span className="ml-1.5 text-(--color-fg-faint)">({l.count})</span>
            </span>
          </li>
        ))}
        {otherPct > 0 && (
          <li className="flex items-baseline justify-between gap-2 text-caption">
            <span className="inline-flex items-center gap-2">
              <span
                aria-hidden
                className="inline-block size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: "var(--chart-other)" }}
              />
              <span className="font-mono text-muted-foreground">Other</span>
            </span>
            <span className="font-mono tabular-nums text-muted-foreground">
              {otherPct.toFixed(0)}%
              <span className="ml-1.5 text-(--color-fg-faint)">({otherCount})</span>
            </span>
          </li>
        )}
      </ul>
    </div>
  );
}

function LanguagesSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-2 w-full rounded-full" />
      <div className="flex flex-col gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between">
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}
