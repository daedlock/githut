import { OrganizationIcon, PeopleIcon } from "@primer/octicons-react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Avatar } from "@/app/components/ui/avatar";
import { EntityHoverLink } from "@/app/components/ui/EntityHoverCard";
import { Skeleton } from "@/app/components/ui/skeleton";
import { cn } from "@/app/lib/cn";
import type { OrgMember, UserOrg } from "../schemas";
import { ProfileSectionHeader } from "./ProfileSectionHeader";

const ORG_SKELETONS = [0, 1, 2, 3, 4];
const MEMBER_SKELETONS = [0, 1, 2, 3, 4, 5];
const MEMBER_PREVIEW_LIMIT = 48;

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

function Orgs({ orgs, isLoading }: { orgs: UserOrg[] | undefined; isLoading: boolean }) {
  if (!isLoading && (!orgs || orgs.length === 0)) return null;

  return (
    <section className="flex flex-col gap-3">
      <Eyebrow
        icon={<OrganizationIcon className="size-3" />}
        label="Organizations"
        count={orgs?.length}
      />
      {isLoading ? (
        <div className="flex flex-wrap gap-2">
          {ORG_SKELETONS.map((i) => (
            <Skeleton key={i} className="size-8 rounded-full" />
          ))}
        </div>
      ) : (
        <ul className="flex flex-wrap items-center gap-1.5">
          {orgs!.map((o) => (
            <li key={o.id}>
              <Link
                to="/$username"
                params={{ username: o.login }}
                title={o.description ?? o.login}
                className={cn(
                  "block rounded-full p-1 outline-none",
                  "transition-colors hover:bg-muted focus-visible:bg-muted",
                  "focus-visible:ring-2 focus-visible:ring-[color:var(--color-focus)]",
                )}
              >
                <Avatar login={o.login} avatarUrl={o.avatar_url} size="lg" className="size-8" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Members({ members, isLoading }: { members: OrgMember[] | undefined; isLoading: boolean }) {
  const [expanded, setExpanded] = useState(false);

  if (!isLoading && (!members || members.length === 0)) return null;

  const visibleMembers = expanded
    ? (members ?? [])
    : (members ?? []).slice(0, MEMBER_PREVIEW_LIMIT);
  const hasMore = !!members && members.length > MEMBER_PREVIEW_LIMIT;

  return (
    <section className="flex flex-col gap-3 overflow-hidden">
      <Eyebrow icon={<PeopleIcon className="size-3" />} label="Members" count={members?.length} />
      {isLoading ? (
        <div className="flex flex-wrap gap-1.5">
          {MEMBER_SKELETONS.map((i) => (
            <div key={i} className="rounded-full p-1">
              <Skeleton className="size-7 shrink-0 rounded-full" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <ul className="flex flex-wrap gap-1.5">
            {visibleMembers.map((m) => (
              <li key={m.id}>
                <EntityHoverLink
                  entity={{ kind: "mention", login: m.login }}
                  href={`https://github.com/${m.login}`}
                  aria-label={m.login}
                  title={m.login}
                  className={cn(
                    "block rounded-full p-1 outline-none",
                    "transition-colors hover:bg-muted focus-visible:bg-muted",
                    "focus-visible:ring-2 focus-visible:ring-[color:var(--color-focus)]",
                  )}
                >
                  <Avatar login={m.login} avatarUrl={m.avatar_url} size="md" />
                </EntityHoverLink>
              </li>
            ))}
          </ul>

          {hasMore ? (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className={cn(
                "self-start rounded-lg px-2 py-1.5 text-caption text-muted-foreground outline-none",
                "transition-colors hover:bg-muted hover:text-foreground focus-visible:bg-muted",
                "focus-visible:ring-2 focus-visible:ring-[color:var(--color-focus)]",
              )}
            >
              {expanded ? "Show fewer members" : `Show all ${members!.length} members`}
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}

function Eyebrow({ icon, label, count }: { icon: React.ReactNode; label: string; count?: number }) {
  return <ProfileSectionHeader icon={icon} title={label} count={count} />;
}
