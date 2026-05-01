import { PeopleIcon, StarIcon } from "@primer/octicons-react";
import { type ReactNode, useMemo } from "react";
import { Card } from "@/app/components/ui/card";
import { Skeleton } from "@/app/components/ui/skeleton";
import type { RepoSummary } from "@/shared/types";
import type { GitHubProfile } from "../schemas";

export type ProfileBentoProps = {
  profile: GitHubProfile | undefined;
  repos: RepoSummary[] | undefined;
  isLoading: boolean;
  /** Org members count (only for orgs). Replaces the `following` tile. */
  membersCount?: number;
};

/**
 * 4-tile bento. Each tile carries one big number plus a quiet sub-line of
 * derived context — so the page doesn't feel like a stat dump but like a
 * concise fact-sheet.
 */
function ProfileBento({ profile, repos, isLoading, membersCount }: ProfileBentoProps) {
  const derived = useMemo(() => {
    if (!repos) return { topLanguage: null, totalStars: 0, mostStarred: null };
    const langCount = new Map<string, number>();
    let totalStars = 0;
    let mostStarred: RepoSummary | null = null;
    for (const r of repos) {
      totalStars += r.stars;
      if (r.language) langCount.set(r.language, (langCount.get(r.language) ?? 0) + 1);
      if (!mostStarred || r.stars > mostStarred.stars) mostStarred = r;
    }
    let topLanguage: string | null = null;
    let topCount = 0;
    for (const [name, count] of langCount) {
      if (count > topCount) {
        topLanguage = name;
        topCount = count;
      }
    }
    return { topLanguage, totalStars, mostStarred };
  }, [repos]);

  if (isLoading || !profile) return <BentoSkeleton />;

  const isOrg = profile.type === "Organization";

  return (
    <section
      aria-label="Profile statistics"
      className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3"
    >
      <Tile
        label="Repositories"
        value={profile.public_repos}
        sub={
          derived.topLanguage ? (
            <span>
              mostly <span className="font-mono text-foreground">{derived.topLanguage}</span>
            </span>
          ) : (
            <span className="text-[color:var(--color-fg-faint)]">no public repos</span>
          )
        }
      />
      <Tile
        label="Stars earned"
        icon={<StarIcon className="size-3" />}
        value={derived.totalStars}
        sub={
          derived.mostStarred && derived.mostStarred.stars > 0 ? (
            <span className="truncate">
              top <span className="font-mono text-foreground">{derived.mostStarred.name}</span>
            </span>
          ) : (
            <span className="text-[color:var(--color-fg-faint)]">no stars yet</span>
          )
        }
      />
      <Tile
        label="Followers"
        icon={<PeopleIcon className="size-3" />}
        value={profile.followers}
        sub={
          profile.followers === 0 ? (
            <span className="text-[color:var(--color-fg-faint)]">none yet</span>
          ) : (
            <span className="text-[color:var(--color-fg-faint)]">people watching</span>
          )
        }
      />
      {isOrg ? (
        <Tile
          label="Members"
          value={membersCount ?? 0}
          sub={
            (membersCount ?? 0) === 0 ? (
              <span className="text-[color:var(--color-fg-faint)]">private or none</span>
            ) : (
              <span className="text-[color:var(--color-fg-faint)]">in this org</span>
            )
          }
        />
      ) : (
        <Tile
          label="Following"
          value={profile.following}
          sub={
            profile.following === 0 ? (
              <span className="text-[color:var(--color-fg-faint)]">none</span>
            ) : (
              <span className="text-[color:var(--color-fg-faint)]">people they watch</span>
            )
          }
        />
      )}
    </section>
  );
}

function Tile({
  label,
  icon,
  value,
  sub,
}: {
  label: string;
  icon?: ReactNode;
  value: number;
  sub: ReactNode;
}) {
  return (
    <Card variant="muted" className="min-w-0 flex flex-col gap-2 px-4 py-3.5">
      <span className="flex items-center gap-1.5 text-caption font-[475] text-muted-foreground">
        {icon && (
          <span className="text-(--color-fg-faint)" aria-hidden="true">
            {icon}
          </span>
        )}
        {label}
      </span>
      <span className="font-mono text-heading font-[475] tabular-nums leading-none text-foreground">
        {formatNum(value)}
      </span>
      <span className="truncate text-caption text-muted-foreground">{sub}</span>
    </Card>
  );
}

function BentoSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
      {[0, 1, 2, 3].map((i) => (
        <Card key={i} variant="muted" className="flex flex-col gap-2 px-4 py-3.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-6 w-12" />
          <Skeleton className="h-3 w-20" />
        </Card>
      ))}
    </div>
  );
}

function formatNum(n: number): string {
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(
    n,
  );
}

export { ProfileBento };
