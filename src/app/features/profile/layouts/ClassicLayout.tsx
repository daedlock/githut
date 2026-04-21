import { Building2, Globe, Mail, MapPin } from "lucide-react";
import { GithubMarkdown } from "@/app/components/GithubMarkdown";
import { Avatar } from "@/app/components/ui/avatar";
import { Container } from "@/app/components/ui/Container";
import { Skeleton } from "@/app/components/ui/skeleton";
import { cn } from "@/app/lib/cn";
import { MemberGrid } from "../components/MemberGrid";
import { OrgAvatarGroup } from "../components/OrgAvatarGroup";
import { ProfileRepoList } from "../components/ProfileRepoList";
import type { ProfileLayoutProps } from "./types";

/**
 * Classic — GitHub-style narrow sidebar + README-first main column.
 * Familiar, calm, works especially well for long READMEs. Sidebar holds
 * the identity; the main column is reading space.
 */
export function ClassicLayout(props: ProfileLayoutProps) {
  const { profile, profileLoading, readme, readmeLoading, onRepoClick } = props;
  const isOrg = profile?.type === "Organization";

  return (
    <Container className="py-6 sm:py-8">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[260px_1fr]">
        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        <aside className="flex flex-col gap-5">
          {profileLoading || !profile ? (
            <SidebarSkeleton />
          ) : (
            <>
              <Avatar
                login={profile.login}
                avatarUrl={profile.avatar_url}
                size="xl"
                className="size-40 rounded-full"
              />
              <div className="flex flex-col gap-1">
                {profile.name && (
                  <h1 className="text-title font-semibold leading-tight tracking-tight text-foreground">
                    {profile.name}
                  </h1>
                )}
                <span className="font-mono text-body text-muted-foreground">
                  {profile.login}
                </span>
              </div>

              {profile.bio && (
                <p className="text-body leading-relaxed text-foreground">{profile.bio}</p>
              )}

              <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1 font-mono text-caption">
                <dt className="text-muted-foreground">repos</dt>
                <dd className="tabular-nums text-foreground">{profile.public_repos}</dd>
                <dt className="text-muted-foreground">followers</dt>
                <dd className="tabular-nums text-foreground">{profile.followers}</dd>
                {!isOrg && (
                  <>
                    <dt className="text-muted-foreground">following</dt>
                    <dd className="tabular-nums text-foreground">{profile.following}</dd>
                  </>
                )}
              </dl>

              <MetaLinks profile={profile} />
            </>
          )}
        </aside>

        {/* ── Main column ─────────────────────────────────────────────── */}
        <main className="min-w-0 flex flex-col gap-8">
          <ReadmeSection loading={readmeLoading} markdown={readme} />

          {isOrg ? (
            <MemberGrid
              members={props.members}
              isLoading={!!props.membersLoading}
              isError={false}
            />
          ) : (
            <OrgAvatarGroup orgs={props.orgs} isLoading={!!props.orgsLoading} />
          )}

          <ProfileRepoList
            repos={props.repos}
            isPending={props.reposLoading}
            onRepoClick={onRepoClick}
          />
        </main>
      </div>
    </Container>
  );
}

function MetaLinks({ profile }: { profile: NonNullable<ProfileLayoutProps["profile"]> }) {
  const rows: { icon: React.ReactNode; label: string; href?: string }[] = [];
  if (profile.location)
    rows.push({ icon: <MapPin className="size-3.5" />, label: profile.location });
  if (profile.company)
    rows.push({
      icon: <Building2 className="size-3.5" />,
      label: profile.company.replace(/^@/, ""),
    });
  if (profile.blog) {
    const url = profile.blog.startsWith("http") ? profile.blog : `https://${profile.blog}`;
    rows.push({
      icon: <Globe className="size-3.5" />,
      label: profile.blog.replace(/^https?:\/\//, ""),
      href: url,
    });
  }
  if (profile.email)
    rows.push({
      icon: <Mail className="size-3.5" />,
      label: profile.email,
      href: `mailto:${profile.email}`,
    });

  if (rows.length === 0) return null;

  return (
    <ul className="flex flex-col gap-1.5 text-body text-muted-foreground">
      {rows.map((row) => (
        <li key={row.label} className="flex items-center gap-2">
          <span className="shrink-0 text-(--color-fg-faint)">{row.icon}</span>
          {row.href ? (
            <a
              href={row.href}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate transition-colors hover:text-foreground"
            >
              {row.label}
            </a>
          ) : (
            <span className="truncate">{row.label}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function ReadmeSection({
  loading,
  markdown,
}: {
  loading: boolean;
  markdown: string | null | undefined;
}) {
  if (loading) {
    return (
      <div className="rounded-md border border-border">
        <div className="border-b border-border bg-(--color-bg-subtle) px-4 py-2 font-mono text-micro uppercase tracking-widest text-muted-foreground">
          Readme
        </div>
        <div className="flex flex-col gap-2 p-6">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </div>
    );
  }
  if (!markdown) return null;
  return (
    <section
      className={cn(
        "overflow-hidden rounded-md border border-border bg-(--color-bg-subtle)",
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-2 font-mono text-micro uppercase tracking-widest text-muted-foreground">
        <span>Readme</span>
        <span className="text-(--color-fg-faint)">profile</span>
      </div>
      <div className="readme-prose max-w-none px-5 py-5 sm:px-8 sm:py-6">
        <GithubMarkdown>{markdown}</GithubMarkdown>
      </div>
    </section>
  );
}

function SidebarSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="size-40 rounded-full" />
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}
