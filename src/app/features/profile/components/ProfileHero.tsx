import { Buildings, CalendarBlank, GlobeHemisphereWest, MapPin } from "@phosphor-icons/react";
import { LinkExternalIcon, MailIcon } from "@primer/octicons-react";
import type { ReactNode } from "react";
import { Avatar } from "@/app/components/ui/avatar";
import { Skeleton, SkeletonGroup } from "@/app/components/ui/skeleton";
import type { GitHubProfile } from "../schemas";

export type ProfileHeroProps = {
  profile: GitHubProfile | undefined;
  isLoading: boolean;
};

/**
 * Identity block: avatar + name + bio + a single inline meta line.
 * Stats live in the bento grid below — keeping the hero tight gives the
 * activity matrix the room it deserves to be the visual centerpiece.
 */
export function ProfileHero({ profile, isLoading }: ProfileHeroProps) {
  if (isLoading || !profile) return <HeroSkeleton />;

  const isOrg = profile.type === "Organization";

  return (
    <header className="flex flex-col gap-4 @xl/pane:flex-row @xl/pane:items-start @xl/pane:gap-5">
      <Avatar
        login={profile.login}
        avatarUrl={profile.avatar_url}
        size="xl"
        className="size-20 shrink-0 rounded-2xl @xl/pane:size-24"
      />

      <div className="min-w-0 flex flex-col gap-1.5">
        <span className="w-fit rounded-full bg-muted px-2 py-0.5 text-caption text-muted-foreground">
          {isOrg ? "Organization" : "User"}
        </span>

        {profile.name ? (
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
            <h1 className="text-heading font-[475] tracking-tight text-foreground text-pretty">
              {profile.name}
            </h1>
            <span className="font-mono text-body text-muted-foreground">@{profile.login}</span>
          </div>
        ) : (
          <h1 className="text-heading font-[475] tracking-tight text-foreground text-pretty">
            @{profile.login}
          </h1>
        )}

        {profile.bio && (
          <p className="mt-0.5 max-w-prose text-body leading-relaxed text-foreground text-pretty">
            {profile.bio}
          </p>
        )}

        <ProfileMetaLine profile={profile} />
      </div>
    </header>
  );
}

function ProfileMetaLine({ profile }: { profile: GitHubProfile }) {
  const items: { key: string; icon: ReactNode; label: string; href?: string }[] = [
    {
      key: "joined",
      icon: <CalendarBlank className="size-3.5" />,
      label: `Joined ${formatJoin(profile.created_at)}`,
    },
  ];
  if (profile.location) {
    items.push({ key: "location", icon: <MapPin className="size-3.5" />, label: profile.location });
  }
  if (profile.company) {
    items.push({
      key: "company",
      icon: <Buildings className="size-3.5" />,
      label: profile.company.replace(/^@/, ""),
    });
  }
  if (profile.blog) {
    const url = profile.blog.startsWith("http") ? profile.blog : `https://${profile.blog}`;
    items.push({
      key: "blog",
      icon: <GlobeHemisphereWest className="size-3.5" />,
      label: profile.blog.replace(/^https?:\/\//, ""),
      href: url,
    });
  }
  if (profile.twitter_username) {
    items.push({
      key: "twitter",
      icon: <span className="font-mono text-caption font-medium leading-none">𝕏</span>,
      label: `@${profile.twitter_username}`,
      href: `https://x.com/${profile.twitter_username}`,
    });
  }
  if (profile.email) {
    items.push({
      key: "email",
      icon: <MailIcon className="size-3.5" />,
      label: profile.email,
      href: `mailto:${profile.email}`,
    });
  }
  items.push({
    key: "github",
    icon: <LinkExternalIcon className="size-3.5" />,
    label: "GitHub",
    href: profile.html_url,
  });

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-ui text-muted-foreground">
      {items.map((it) => (
        <span key={it.key} className="inline-flex min-w-0 items-center gap-1.5">
          <span className="text-(--color-fg-faint)" aria-hidden="true">
            {it.icon}
          </span>
          {it.href ? (
            <a
              href={it.href}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 truncate transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-(--color-focus)"
            >
              {it.label}
            </a>
          ) : (
            <span className="min-w-0 truncate">{it.label}</span>
          )}
        </span>
      ))}
    </div>
  );
}

function HeroSkeleton() {
  return (
    <SkeletonGroup label="Loading profile" className="flex flex-col gap-4 @xl/pane:flex-row @xl/pane:items-start @xl/pane:gap-5">
      <Skeleton className="size-20 shrink-0 rounded-2xl @xl/pane:size-24" />
      <div className="flex min-w-0 flex-col gap-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80" />
        <div className="mt-1 flex flex-wrap gap-3">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3.5 w-28" />
        </div>
      </div>
    </SkeletonGroup>
  );
}

function formatJoin(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}
