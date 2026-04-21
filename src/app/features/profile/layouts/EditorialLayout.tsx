import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { GithubMarkdown } from "@/app/components/GithubMarkdown";
import { Avatar } from "@/app/components/ui/avatar";
import { Container } from "@/app/components/ui/Container";
import { Skeleton } from "@/app/components/ui/skeleton";
import { cn } from "@/app/lib/cn";
import { formatRelativeTime } from "@/app/lib/time";
import type { RepoSummary } from "@/shared/types";
import type { ProfileLayoutProps } from "./types";

/**
 * Editorial — magazine-style hero + long-form reading column.
 * Large avatar sits beside an oversized display headline of the login;
 * name drops below in italic counterpoint; bio renders as a pull-quote
 * with a rule rather than a box. Stats read as prose. README occupies
 * a centred reading column. Repos render as a two-column table.
 */
export function EditorialLayout(props: ProfileLayoutProps) {
  const { profile, profileLoading, repos, reposLoading, readme, readmeLoading, onRepoClick } =
    props;
  const isOrg = profile?.type === "Organization";

  return (
    <Container className="py-10 sm:py-14">
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[160px_1fr] lg:gap-12">
        {profileLoading || !profile ? (
          <HeroSkeleton />
        ) : (
          <>
            <Avatar
              login={profile.login}
              avatarUrl={profile.avatar_url}
              size="xl"
              className="size-32 rounded-full ring-4 ring-(--color-bg-subtle) ring-offset-4 ring-offset-(--color-bg) lg:size-40"
            />
            <div className="min-w-0 flex flex-col gap-3">
              <span className="font-mono text-micro uppercase tracking-[0.3em] text-(--color-fg-faint)">
                {isOrg ? "Organization" : "Profile"}
              </span>
              <h1 className="break-words font-mono text-display font-semibold leading-[0.95] tracking-tight text-foreground">
                {profile.login}
                <span className="text-(--color-accent)">_</span>
              </h1>
              {profile.name && (
                <p className="font-sans text-title italic text-muted-foreground">
                  {profile.name}
                </p>
              )}
              {profile.bio && (
                <blockquote className="mt-2 max-w-xl border-l-2 border-(--color-accent) pl-4 font-sans text-body leading-relaxed text-foreground">
                  {profile.bio}
                </blockquote>
              )}
              <ProseStats
                repos={profile.public_repos}
                followers={profile.followers}
                following={isOrg ? undefined : profile.following}
                joinedIso={profile.created_at}
                location={profile.location}
              />
            </div>
          </>
        )}
      </section>

      {/* ── README as long-form ──────────────────────────────────────── */}
      <section className="mt-14">
        {readmeLoading ? (
          <div className="mx-auto max-w-[70ch]">
            <Skeleton className="mb-4 h-5 w-40" />
            <Skeleton className="mb-2 h-4 w-full" />
            <Skeleton className="mb-2 h-4 w-11/12" />
            <Skeleton className="mb-2 h-4 w-10/12" />
          </div>
        ) : readme ? (
          <article className="mx-auto max-w-[70ch]">
            <div className="mb-6 flex items-center gap-3 font-mono text-micro uppercase tracking-[0.3em] text-(--color-fg-faint)">
              <span className="h-px w-8 bg-(--color-border-strong)" />
              <span>Readme</span>
            </div>
            <div className="readme-prose text-body-lg leading-[1.75]">
              <GithubMarkdown>{readme}</GithubMarkdown>
            </div>
          </article>
        ) : null}
      </section>

      {/* ── Featured repositories ────────────────────────────────────── */}
      <section className="mt-16 border-t border-border pt-10">
        <header className="mb-6 flex items-baseline justify-between">
          <h2 className="font-mono text-title font-semibold tracking-tight text-foreground">
            Works
          </h2>
          <span className="font-mono text-caption text-(--color-fg-faint)">
            {repos ? `${repos.length} total` : ""}
          </span>
        </header>
        {reposLoading ? (
          <WorksSkeleton />
        ) : !repos || repos.length === 0 ? (
          <p className="py-4 font-sans text-body italic text-(--color-fg-faint)">
            No public works on display.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-x-10 gap-y-6 md:grid-cols-2">
            {repos.slice(0, 12).map((r) => (
              <WorkCard key={r.id} repo={r} onClick={() => onRepoClick(r)} />
            ))}
          </div>
        )}
      </section>

      {/* ── Roster ────────────────────────────────────────────────────── */}
      <RosterSection
        heading={isOrg ? "Members" : "Affiliations"}
        items={
          isOrg
            ? (props.members ?? []).map((m) => ({
                key: String(m.id),
                login: m.login,
                avatar_url: m.avatar_url,
              }))
            : (props.orgs ?? []).map((o) => ({
                key: String(o.id),
                login: o.login,
                avatar_url: o.avatar_url,
              }))
        }
      />
    </Container>
  );
}

function ProseStats({
  repos,
  followers,
  following,
  joinedIso,
  location,
}: {
  repos: number;
  followers: number;
  following?: number;
  joinedIso: string;
  location: string | null;
}) {
  const joined = new Date(joinedIso).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  return (
    <p className="mt-3 font-sans text-body leading-relaxed text-muted-foreground">
      <Stat value={repos} noun="repositories" />, <Stat value={followers} noun="followers" />
      {following !== undefined ? (
        <>
          , following <Num n={following} />{" "}
        </>
      ) : (
        " "
      )}
      · joined <span className="text-foreground">{joined}</span>
      {location ? (
        <>
          {" "}
          · <span className="text-foreground">{location}</span>
        </>
      ) : null}
      .
    </p>
  );
}

function Stat({ value, noun }: { value: number; noun: string }) {
  return (
    <>
      <Num n={value} /> {noun}
    </>
  );
}

function Num({ n }: { n: number }) {
  return <span className="font-mono tabular-nums text-foreground">{format(n)}</span>;
}

function format(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function WorkCard({ repo, onClick }: { repo: RepoSummary; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex flex-col items-start gap-1.5 border-t border-border pt-4 text-left",
        "transition-colors",
      )}
    >
      <div className="flex w-full items-baseline justify-between gap-3">
        <h3 className="font-mono text-body-lg font-medium tracking-tight text-foreground transition-colors group-hover:text-(--color-accent)">
          {repo.name}
        </h3>
        <ArrowUpRight className="size-3.5 shrink-0 text-(--color-fg-faint) transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-(--color-accent)" />
      </div>
      {repo.description && (
        <p className="line-clamp-2 font-sans text-body italic text-muted-foreground">
          {repo.description}
        </p>
      )}
      <div className="mt-1 flex items-center gap-3 font-mono text-caption text-(--color-fg-faint)">
        {repo.language && <span className="text-muted-foreground">{repo.language}</span>}
        {repo.language && <span>·</span>}
        <span>★ {repo.stars}</span>
        <span>·</span>
        <span>{formatRelativeTime(repo.pushedAt)}</span>
      </div>
    </button>
  );
}

function RosterSection({
  heading,
  items,
}: {
  heading: string;
  items: { key: string; login: string; avatar_url: string }[];
}) {
  if (items.length === 0) return null;
  return (
    <section className="mt-16 border-t border-border pt-10">
      <h2 className="mb-4 font-mono text-micro uppercase tracking-[0.3em] text-muted-foreground">
        {heading}
      </h2>
      <div className="flex flex-wrap gap-3">
        {items.map((item) => (
          <Link
            key={item.key}
            to="/$username"
            params={{ username: item.login }}
            className="flex items-center gap-2 rounded-full border border-border bg-(--color-bg-subtle) px-3 py-1.5 font-mono text-caption transition-colors hover:border-(--color-accent)"
            title={item.login}
          >
            <Avatar login={item.login} avatarUrl={item.avatar_url} size="xs" />
            <span className="text-foreground">{item.login}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function HeroSkeleton() {
  return (
    <>
      <Skeleton className="size-32 rounded-full lg:size-40" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
    </>
  );
}

function WorksSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2 border-t border-border pt-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
    </div>
  );
}
