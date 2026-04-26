import { Link } from "@tanstack/react-router";
import { Network, Users } from "lucide-react";
import { Avatar } from "@/app/components/ui/avatar";
import { Skeleton } from "@/app/components/ui/skeleton";
import { cn } from "@/app/lib/cn";
import type { OrgMember, UserOrg } from "../schemas";

export type ProfileRosterProps = {
  isOrg: boolean;
  orgs?: UserOrg[];
  orgsLoading?: boolean;
  members?: OrgMember[];
  membersLoading?: boolean;
};

/**
 * Bottom-of-page roster: Organizations for users, Members for orgs.
 * Renders nothing when the relevant collection is empty so the page
 * doesn't end on a dead block.
 */
export function ProfileRoster({
  isOrg,
  orgs,
  orgsLoading,
  members,
  membersLoading,
}: ProfileRosterProps) {
  if (isOrg) {
    return <Members members={members} isLoading={!!membersLoading} />;
  }
  return <Orgs orgs={orgs} isLoading={!!orgsLoading} />;
}

function Orgs({
  orgs,
  isLoading,
}: {
  orgs: UserOrg[] | undefined;
  isLoading: boolean;
}) {
  if (!isLoading && (!orgs || orgs.length === 0)) return null;

  return (
    <section className="flex flex-col gap-3">
      <Eyebrow
        icon={<Network className="size-3" />}
        label="Organizations"
        count={orgs?.length}
      />
      {isLoading ? (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="size-8 rounded-full" />
          ))}
        </div>
      ) : (
        <ul className="flex flex-wrap items-center gap-2">
          {orgs!.map((o) => (
            <li key={o.id}>
              <Link
                to="/$username"
                params={{ username: o.login }}
                title={o.description ?? o.login}
                className={cn(
                  "block rounded-full outline-none transition-opacity",
                  "hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[color:var(--color-focus)]",
                )}
              >
                <Avatar
                  login={o.login}
                  avatarUrl={o.avatar_url}
                  size="lg"
                  className="size-8"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Members({
  members,
  isLoading,
}: {
  members: OrgMember[] | undefined;
  isLoading: boolean;
}) {
  if (!isLoading && (!members || members.length === 0)) return null;

  return (
    <section className="flex flex-col gap-3">
      <Eyebrow
        icon={<Users className="size-3" />}
        label="Members"
        count={members?.length}
      />
      {isLoading ? (
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 px-1.5 py-1">
              <Skeleton className="size-6 shrink-0 rounded-full" />
              <Skeleton className="h-3 flex-1" />
            </div>
          ))}
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-x-1 gap-y-0.5 sm:grid-cols-3">
          {members!.map((m) => (
            <li key={m.id}>
              <Link
                to="/$username"
                params={{ username: m.login }}
                className={cn(
                  "flex items-center gap-2 rounded-md px-1.5 py-1 outline-none",
                  "transition-colors hover:bg-accent",
                  "focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-[color:var(--color-focus)]",
                )}
              >
                <Avatar login={m.login} avatarUrl={m.avatar_url} size="md" />
                <span className="truncate font-mono text-caption text-foreground">
                  {m.login}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Eyebrow({
  icon,
  label,
  count,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <h2 className="flex items-center gap-1.5 font-mono text-micro uppercase tracking-widest text-muted-foreground">
      <span className="text-[color:var(--color-fg-faint)]">{icon}</span>
      {label}
      {typeof count === "number" && (
        <span className="font-mono text-micro tabular-nums text-[color:var(--color-fg-faint)]">
          {count}
        </span>
      )}
    </h2>
  );
}
