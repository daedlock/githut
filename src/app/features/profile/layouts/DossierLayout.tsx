import { Link } from "@tanstack/react-router";
import { GithubMarkdown } from "@/app/components/GithubMarkdown";
import { Avatar } from "@/app/components/ui/avatar";
import { Container } from "@/app/components/ui/Container";
import { Skeleton } from "@/app/components/ui/skeleton";
import { cn } from "@/app/lib/cn";
import { formatRelativeTime } from "@/app/lib/time";
import type { RepoSummary } from "@/shared/types";
import type { ProfileLayoutProps } from "./types";

/**
 * Dossier — the GitHut-native layout. Left rail is a "personnel file"
 * header: avatar, login, mono-labeled fields in a tight grid. Right is
 * the README as a reading column. Below is the repo "inventory" — dense,
 * numbered, tabular. Meant to feel like cat-ing a profile from a terminal.
 */
export function DossierLayout(props: ProfileLayoutProps) {
  const { profile, profileLoading, repos, reposLoading, readme, readmeLoading, onRepoClick } =
    props;
  const isOrg = profile?.type === "Organization";

  return (
    <Container className="py-6 sm:py-8">
      {/* ── Header grid ───────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 gap-8 lg:grid-cols-[280px_1fr] lg:gap-10">
        <aside className="flex flex-col gap-5">
          {profileLoading || !profile ? (
            <DossierSkeleton />
          ) : (
            <>
              <div className="flex items-center gap-4">
                <Avatar
                  login={profile.login}
                  avatarUrl={profile.avatar_url}
                  size="xl"
                  className="size-24 rounded-sm"
                />
                <div className="min-w-0 flex flex-col gap-0.5">
                  <span className="font-mono text-micro uppercase tracking-widest text-(--color-fg-faint)">
                    {isOrg ? "Organization" : "User"}
                  </span>
                  <span className="truncate font-mono text-body font-medium text-foreground">
                    {profile.login}
                  </span>
                  {profile.name && (
                    <span className="truncate font-sans text-caption italic text-muted-foreground">
                      {profile.name}
                    </span>
                  )}
                </div>
              </div>

              {profile.bio && (
                <p className="border-l-2 border-(--color-accent) pl-3 font-sans text-body italic leading-relaxed text-foreground">
                  {profile.bio}
                </p>
              )}

              <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1.5 border-y border-border py-3 font-mono text-caption">
                <Field label="joined" value={formatJoin(profile.created_at)} />
                <Field label="repos" value={String(profile.public_repos)} />
                <Field label="followers" value={String(profile.followers)} />
                {!isOrg && <Field label="following" value={String(profile.following)} />}
                {profile.location && <Field label="location" value={profile.location} />}
                {profile.company && (
                  <Field label="company" value={profile.company.replace(/^@/, "")} />
                )}
                {profile.blog && (
                  <Field
                    label="blog"
                    value={profile.blog.replace(/^https?:\/\//, "")}
                    href={profile.blog.startsWith("http") ? profile.blog : `https://${profile.blog}`}
                  />
                )}
                {profile.twitter_username && (
                  <Field
                    label="𝕏"
                    value={`@${profile.twitter_username}`}
                    href={`https://x.com/${profile.twitter_username}`}
                  />
                )}
                {profile.email && (
                  <Field label="email" value={profile.email} href={`mailto:${profile.email}`} />
                )}
              </dl>

              {/* Roster — orgs (user) or members (org) */}
              {isOrg ? (
                props.members && props.members.length > 0 ? (
                  <RosterStrip
                    heading={`Members · ${props.members.length}`}
                    avatars={props.members.map((m) => ({
                      key: String(m.id),
                      login: m.login,
                      avatar_url: m.avatar_url,
                    }))}
                  />
                ) : null
              ) : props.orgs && props.orgs.length > 0 ? (
                <RosterStrip
                  heading={`Orgs · ${props.orgs.length}`}
                  avatars={props.orgs.map((o) => ({
                    key: String(o.id),
                    login: o.login,
                    avatar_url: o.avatar_url,
                  }))}
                />
              ) : null}
            </>
          )}
        </aside>

        {/* ── README column ────────────────────────────────────────────── */}
        <div className="min-w-0">
          <DossierReadme loading={readmeLoading} markdown={readme} />
        </div>
      </section>

      {/* ── Inventory — numbered repo table ───────────────────────────── */}
      <section className="mt-12">
        <header className="mb-4 flex items-baseline justify-between border-b border-border pb-2">
          <h2 className="font-mono text-micro uppercase tracking-widest text-muted-foreground">
            Inventory
          </h2>
          <span className="font-mono text-micro tabular-nums text-(--color-fg-faint)">
            {repos ? `${repos.length} repos` : ""}
          </span>
        </header>
        {reposLoading ? (
          <InventorySkeleton />
        ) : !repos || repos.length === 0 ? (
          <p className="py-6 text-center font-mono text-ui text-(--color-fg-faint)">
            No repositories.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {repos.map((r, i) => (
              <InventoryRow key={r.id} index={i + 1} repo={r} onClick={() => onRepoClick(r)} />
            ))}
          </ul>
        )}
      </section>
    </Container>
  );
}

// ─── Field (dt/dd row) ──────────────────────────────────────────────────────

function Field({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <>
      <dt className="truncate uppercase tracking-widest text-(--color-fg-faint)">{label}</dt>
      <dd className="truncate tabular-nums text-foreground">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-(--color-accent)"
          >
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </>
  );
}

// ─── Roster strip ───────────────────────────────────────────────────────────

function RosterStrip({
  heading,
  avatars,
}: {
  heading: string;
  avatars: { key: string; login: string; avatar_url: string }[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-micro uppercase tracking-widest text-muted-foreground">
        {heading}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {avatars.slice(0, 12).map((a) => (
          <Link
            key={a.key}
            to="/$username"
            params={{ username: a.login }}
            className="rounded-full outline-none transition-opacity hover:opacity-80 focus-visible:ring-1 focus-visible:ring-foreground/15"
            title={a.login}
          >
            <Avatar login={a.login} avatarUrl={a.avatar_url} size="md" />
          </Link>
        ))}
        {avatars.length > 12 && (
          <span className="inline-flex size-7 items-center justify-center rounded-full bg-(--color-bg-sunken) font-mono text-micro text-muted-foreground">
            +{avatars.length - 12}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── README panel ───────────────────────────────────────────────────────────

function DossierReadme({
  loading,
  markdown,
}: {
  loading: boolean;
  markdown: string | null | undefined;
}) {
  if (loading) {
    return <Skeleton className="h-64 w-full" />;
  }
  if (!markdown) {
    return (
      <div
        className={cn(
          "flex h-full min-h-[120px] items-center justify-center rounded-sm",
          "border border-dashed border-border p-6",
          "font-mono text-caption text-(--color-fg-faint)",
        )}
      >
        no profile readme
      </div>
    );
  }
  return (
    <article>
      <header className="mb-4 flex items-baseline gap-2 border-b border-border pb-2">
        <h2 className="font-mono text-micro uppercase tracking-widest text-muted-foreground">
          Readme.md
        </h2>
      </header>
      <div className="readme-prose max-w-[65ch] text-body">
        <GithubMarkdown>{markdown}</GithubMarkdown>
      </div>
    </article>
  );
}

// ─── Inventory row ──────────────────────────────────────────────────────────

function InventoryRow({
  index,
  repo,
  onClick,
}: {
  index: number;
  repo: RepoSummary;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "group flex w-full items-baseline gap-4 py-2.5 text-left",
          "transition-colors hover:bg-(--color-bg-sunken)",
        )}
      >
        <span className="w-8 shrink-0 pl-1 text-right font-mono text-caption tabular-nums text-(--color-fg-faint)">
          {String(index).padStart(3, "0")}
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-body font-medium text-foreground group-hover:text-(--color-accent)">
          {repo.name}
        </span>
        {repo.description && (
          <span className="hidden min-w-0 flex-[2] truncate font-sans text-caption italic text-muted-foreground md:block">
            {repo.description}
          </span>
        )}
        <span className="hidden w-16 shrink-0 text-right font-mono text-caption tabular-nums text-muted-foreground sm:block">
          {repo.language ?? "—"}
        </span>
        <span className="hidden w-14 shrink-0 text-right font-mono text-caption tabular-nums text-muted-foreground sm:block">
          ★ {repo.stars}
        </span>
        <span className="hidden w-20 shrink-0 pr-2 text-right font-mono text-caption text-(--color-fg-faint) sm:block">
          {formatRelativeTime(repo.pushedAt)}
        </span>
      </button>
    </li>
  );
}

// ─── Skeletons ──────────────────────────────────────────────────────────────

function DossierSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <Skeleton className="size-24 rounded-sm" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-40" />
        </div>
      </div>
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

function InventorySkeleton() {
  return (
    <ul className="divide-y divide-border">
      {Array.from({ length: 5 }).map((_, i) => (
        <li key={i} className="flex items-baseline gap-4 py-2.5">
          <Skeleton className="h-3 w-8" />
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 flex-1" />
        </li>
      ))}
    </ul>
  );
}

function formatJoin(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
  });
}
