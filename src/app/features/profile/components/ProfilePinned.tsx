import { PinIcon, StarIcon } from "@primer/octicons-react";
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Skeleton } from "@/app/components/ui/skeleton";
import { cn } from "@/app/lib/cn";
import { formatRelativeTime } from "@/app/lib/time";
import type { RepoSummary } from "@/shared/types";
import { ProfileSectionHeader } from "./ProfileSectionHeader";

const TOP = 3;

export type ProfilePinnedProps = {
  repos: RepoSummary[] | undefined;
  isLoading: boolean;
};

/**
 * "Top repositories" — best-of strip: top-3 starred repos as cards. Cards
 * are bg-muted tiles (no border) to keep them inside the page rhythm but
 * give them enough surface to read as a distinct featured block.
 */
export function ProfilePinned({ repos, isLoading }: ProfilePinnedProps) {
  const top = useMemo(() => {
    if (!repos) return [];
    return [...repos]
      .filter((r) => r.stars > 0)
      .sort((a, b) => b.stars - a.stars)
      .slice(0, TOP);
  }, [repos]);

  if (isLoading) return <PinnedSkeleton />;
  if (top.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <ProfileSectionHeader
        title="Top Repositories"
        icon={<PinIcon className="size-3 text-(--color-fg-faint)" />}
      />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
        {top.map((r) => (
          <PinnedCard key={r.id} repo={r} />
        ))}
      </div>
    </section>
  );
}

function PinnedCard({ repo }: { repo: RepoSummary }) {
  return (
    <Link
      to="/$owner/$repo"
      params={{ owner: repo.owner.login, repo: repo.name }}
      className={cn(
        "group flex h-full min-h-[112px] flex-col gap-2 rounded-xl bg-muted px-4 py-3.5",
        "outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-focus)]",
      )}
    >
      <header className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate font-mono text-body font-medium text-foreground group-hover:text-[color:var(--color-accent)]">
          {repo.name}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 font-mono text-caption tabular-nums text-muted-foreground">
          <StarIcon className="size-3" />
          {formatStars(repo.stars)}
        </span>
      </header>

      <p
        className={cn(
          "flex-1 line-clamp-3 text-caption leading-relaxed",
          repo.description ? "text-muted-foreground" : "italic text-[color:var(--color-fg-faint)]",
        )}
      >
        {repo.description ?? "No description"}
      </p>

      <footer className="flex items-center justify-between gap-2 text-caption text-(--color-fg-faint)">
        {repo.language ? (
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block size-2 rounded-full"
              style={{ backgroundColor: "var(--chart-slot-1)" }}
            />
            <span className="text-muted-foreground">{repo.language}</span>
          </span>
        ) : (
          <span />
        )}
        <span className="font-mono tabular-nums">{formatRelativeTime(repo.pushedAt)}</span>
      </footer>
    </Link>
  );
}

function PinnedSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-3 w-32" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[112px] rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function formatStars(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
