import { Link } from "@tanstack/react-router";
import { Avatar } from "@/app/components/ui/avatar";
import { Skeleton } from "@/app/components/ui/skeleton";
import type { UserOrg } from "../schemas";

export type OrgAvatarGroupProps = {
  orgs: UserOrg[] | undefined;
  isLoading: boolean;
};

export function OrgAvatarGroup({ orgs, isLoading }: OrgAvatarGroupProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <span className="font-mono text-micro uppercase tracking-widest text-muted-foreground">
          Organizations
        </span>
        <div className="flex items-center gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="size-7 rounded-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!orgs || orgs.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <h3 className="font-mono text-micro uppercase tracking-widest text-muted-foreground">
          Organizations
        </h3>
        <span className="font-mono text-micro tabular-nums text-(--color-fg-faint)">
          {orgs.length}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {orgs.map((org) => (
          <Link
            key={org.id}
            to="/$username"
            params={{ username: org.login }}
            className="rounded-full outline-none focus-visible:ring-1 focus-visible:ring-foreground/15"
            title={org.description ?? org.login}
          >
            <Avatar login={org.login} avatarUrl={org.avatar_url} size="lg" />
          </Link>
        ))}
      </div>
    </div>
  );
}
