import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Building2, Globe, MapPin, Users } from "lucide-react";
import { GithubMarkdown } from "@/app/components/GithubMarkdown";
import { Avatar } from "@/app/components/ui/avatar";
import { Container } from "@/app/components/ui/Container";
import { Skeleton } from "@/app/components/ui/skeleton";
import { cn } from "@/app/lib/cn";
import type { RepoSummary } from "@/shared/types";
import type { ProfileLayoutProps } from "./types";

/**
 * Grid — bento-box dashboard. Every piece of info lives in its own card,
 * sized by importance. The identity card spans two cells vertically; the
 * README card spans the full width (truncated preview); stats and roster
 * fill the remaining cells. Optimized for at-a-glance scanning.
 */
export function GridLayout(props: ProfileLayoutProps) {
  const { profile, profileLoading, repos, reposLoading, readme, readmeLoading, onRepoClick } =
    props;
  const isOrg = profile?.type === "Organization";

  return (
    <Container className="py-6 sm:py-8">
      {/* Header + meta row */}
      <div
        className={cn(
          "grid grid-cols-1 gap-3",
          "md:grid-cols-6 md:grid-rows-[auto_auto]",
        )}
      >
        {/* Identity card — spans 3 cols, 2 rows */}
        <Card className="md:col-span-3 md:row-span-2">
          {profileLoading || !profile ? (
            <IdentitySkeleton />
          ) : (
            <div className="flex h-full flex-col gap-3">
              <div className="flex items-center gap-4">
                <Avatar
                  login={profile.login}
                  avatarUrl={profile.avatar_url}
                  size="xl"
                  className="size-16 rounded-full"
                />
                <div className="min-w-0 flex flex-col">
                  {profile.name && (
                    <h1 className="truncate text-title font-semibold tracking-tight text-foreground">
                      {profile.name}
                    </h1>
                  )}
                  <span className="truncate font-mono text-caption text-muted-foreground">
                    {profile.login}
                  </span>
                </div>
              </div>
              {profile.bio && (
                <p className="text-body leading-relaxed text-foreground">{profile.bio}</p>
              )}
              <ul className="mt-auto flex flex-col gap-1.5 text-caption text-muted-foreground">
                {profile.location && (
                  <li className="flex items-center gap-1.5">
                    <MapPin className="size-3 text-(--color-fg-faint)" /> {profile.location}
                  </li>
                )}
                {profile.company && (
                  <li className="flex items-center gap-1.5">
                    <Building2 className="size-3 text-(--color-fg-faint)" />{" "}
                    {profile.company.replace(/^@/, "")}
                  </li>
                )}
                {profile.blog && (
                  <li className="flex items-center gap-1.5">
                    <Globe className="size-3 text-(--color-fg-faint)" />
                    <a
                      href={
                        profile.blog.startsWith("http") ? profile.blog : `https://${profile.blog}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate transition-colors hover:text-foreground"
                    >
                      {profile.blog.replace(/^https?:\/\//, "")}
                    </a>
                  </li>
                )}
              </ul>
            </div>
          )}
        </Card>

        {/* Stats card — 3 cols, 1 row */}
        <Card className="md:col-span-3">
          {profileLoading || !profile ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <div className="grid h-full grid-cols-3 gap-2">
              <Stat label="repos" value={profile.public_repos} />
              <Stat label="followers" value={profile.followers} />
              <Stat
                label={isOrg ? "joined" : "following"}
                value={isOrg ? undefined : profile.following}
                text={isOrg ? formatJoin(profile.created_at) : undefined}
              />
            </div>
          )}
        </Card>

        {/* Roster card — 3 cols, 1 row */}
        <Card className="md:col-span-3">
          <div className="flex h-full flex-col gap-2">
            <CardLabel
              icon={<Users className="size-3" />}
              label={isOrg ? "Members" : "Organizations"}
              count={isOrg ? props.members?.length : props.orgs?.length}
            />
            <RosterInline
              loading={isOrg ? !!props.membersLoading : !!props.orgsLoading}
              avatars={
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
          </div>
        </Card>
      </div>

      {/* README card — full width */}
      {(readmeLoading || readme) && (
        <Card className="mt-3">
          <CardLabel label="Readme" subtle="profile" />
          {readmeLoading ? (
            <div className="mt-3 flex flex-col gap-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          ) : readme ? (
            <div className="readme-prose mt-2 max-h-[420px] overflow-hidden text-body">
              <GithubMarkdown>{readme}</GithubMarkdown>
            </div>
          ) : null}
        </Card>
      )}

      {/* Repo grid — 2 cols */}
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card>
          <CardLabel label="Top repositories" count={repos?.length} />
          {reposLoading ? (
            <RepoListSkeleton />
          ) : !repos?.length ? (
            <p className="py-4 text-center font-mono text-caption text-(--color-fg-faint)">
              No repos.
            </p>
          ) : (
            <ul className="mt-2 flex flex-col gap-0.5">
              {repos.slice(0, 6).map((r) => (
                <RepoRow key={r.id} repo={r} onClick={() => onRepoClick(r)} />
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardLabel label="Recently pushed" />
          {reposLoading ? (
            <RepoListSkeleton />
          ) : !repos?.length ? (
            <p className="py-4 text-center font-mono text-caption text-(--color-fg-faint)">
              No activity.
            </p>
          ) : (
            <ul className="mt-2 flex flex-col gap-0.5">
              {[...repos]
                .sort((a, b) => (a.pushedAt < b.pushedAt ? 1 : -1))
                .slice(0, 6)
                .map((r) => (
                  <RepoRow key={r.id} repo={r} onClick={() => onRepoClick(r)} />
                ))}
            </ul>
          )}
        </Card>
      </div>
    </Container>
  );
}

// ─── Card primitives ────────────────────────────────────────────────────────

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-md border border-border bg-(--color-bg-subtle) p-4 sm:p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

function CardLabel({
  icon,
  label,
  count,
  subtle,
}: {
  icon?: React.ReactNode;
  label: string;
  count?: number;
  subtle?: string;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="flex items-center gap-1.5 font-mono text-micro uppercase tracking-widest text-muted-foreground">
        {icon && <span className="text-(--color-fg-faint)">{icon}</span>}
        {label}
      </span>
      {count !== undefined && (
        <span className="font-mono text-micro tabular-nums text-(--color-fg-faint)">{count}</span>
      )}
      {subtle && (
        <span className="ml-auto font-mono text-micro text-(--color-fg-faint)">{subtle}</span>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  text,
}: {
  label: string;
  value?: number;
  text?: string;
}) {
  return (
    <div className="flex flex-col items-start justify-end gap-0.5">
      <span className="font-mono text-display font-semibold tabular-nums leading-none text-foreground">
        {text ?? (value !== undefined ? compact(value) : "—")}
      </span>
      <span className="font-mono text-micro uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function RepoRow({ repo, onClick }: { repo: RepoSummary; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="group flex w-full items-center justify-between gap-3 rounded-sm px-1.5 py-1.5 text-left transition-colors hover:bg-(--color-bg-sunken)"
      >
        <span className="min-w-0 flex-1 truncate font-mono text-body text-foreground group-hover:text-(--color-accent)">
          {repo.name}
        </span>
        <span className="flex shrink-0 items-center gap-2 font-mono text-caption text-muted-foreground">
          {repo.language && <span>{repo.language}</span>}
          <span className="tabular-nums">★ {repo.stars}</span>
          <ArrowUpRight className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
        </span>
      </button>
    </li>
  );
}

function RosterInline({
  loading,
  avatars,
}: {
  loading: boolean;
  avatars: { key: string; login: string; avatar_url: string }[];
}) {
  if (loading) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="size-7 rounded-full" />
        ))}
      </div>
    );
  }
  if (!avatars.length) {
    return (
      <p className="py-3 text-center font-mono text-caption text-(--color-fg-faint)">
        None visible.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {avatars.slice(0, 16).map((a) => (
        <Link
          key={a.key}
          to="/$username"
          params={{ username: a.login }}
          className="rounded-full outline-none transition-opacity hover:opacity-80"
          title={a.login}
        >
          <Avatar login={a.login} avatarUrl={a.avatar_url} size="md" />
        </Link>
      ))}
      {avatars.length > 16 && (
        <span className="inline-flex size-7 items-center justify-center rounded-full bg-(--color-bg-sunken) font-mono text-micro text-muted-foreground">
          +{avatars.length - 16}
        </span>
      )}
    </div>
  );
}

function IdentitySkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

function RepoListSkeleton() {
  return (
    <div className="mt-2 flex flex-col gap-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-4" />
      ))}
    </div>
  );
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatJoin(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
  });
}
