import { Building2, ExternalLink } from "lucide-react";
import { Avatar } from "@/app/components/ui/avatar";
import { Skeleton } from "@/app/components/ui/skeleton";
import { cn } from "@/app/lib/cn";
import type { GitHubProfile } from "../schemas";

export type ProfileHeaderProps = {
  profile: GitHubProfile | undefined;
  isLoading: boolean;
};

function formatJoinDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}

export function ProfileHeader({ profile, isLoading }: ProfileHeaderProps) {
  if (isLoading || !profile) {
    return <ProfileHeaderSkeleton />;
  }

  const isOrg = profile.type === "Organization";

  return (
    <div className="flex items-start gap-5">
      <Avatar login={profile.login} avatarUrl={profile.avatar_url} size="xl" />

      <div className="min-w-0 flex flex-col gap-1.5">
        {/* Name + login */}
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          {profile.name ? (
            <>
              <h1 className="text-heading font-semibold tracking-tight text-foreground">
                {profile.name}
              </h1>
              <span className="font-mono text-body text-muted-foreground">
                @{profile.login}
              </span>
            </>
          ) : (
            <h1 className="text-heading font-semibold tracking-tight text-foreground">
              {profile.login}
            </h1>
          )}
        </div>

        {/* Type badge + join date + external link */}
        <div className="flex flex-wrap items-center gap-1.5 font-mono text-caption text-muted-foreground">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5",
              "text-micro uppercase tracking-widest",
              "bg-(--color-bg-sunken) text-(--color-fg-faint)",
            )}
          >
            {isOrg ? <Building2 className="size-3" /> : null}
            {profile.type}
          </span>
          <span className="text-(--color-fg-faint)">·</span>
          <span>Joined {formatJoinDate(profile.created_at)}</span>
          <a
            href={profile.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
            title="View on GitHub"
          >
            <ExternalLink className="size-3" />
          </a>
        </div>

        {/* Bio / description */}
        {profile.bio && (
          <p className="max-w-lg text-body leading-relaxed text-foreground">
            {profile.bio}
          </p>
        )}
      </div>
    </div>
  );
}

function ProfileHeaderSkeleton() {
  return (
    <div className="flex items-start gap-5">
      <Skeleton className="size-16 shrink-0 rounded-full" />
      <div className="flex min-w-0 flex-col gap-2.5">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-4 w-80" />
      </div>
    </div>
  );
}
