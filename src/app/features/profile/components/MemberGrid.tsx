import { Link } from "@tanstack/react-router";
import { Avatar } from "@/app/components/ui/avatar";
import { Skeleton } from "@/app/components/ui/skeleton";
import { cn } from "@/app/lib/cn";
import type { OrgMember } from "../schemas";

export type MemberGridProps = {
  members: OrgMember[] | undefined;
  isLoading: boolean;
  isError: boolean;
};

export function MemberGrid({ members, isLoading, isError }: MemberGridProps) {
  if (isError) return null;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <span className="font-mono text-micro uppercase tracking-widest text-muted-foreground">
          Members
        </span>
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 px-2 py-1.5">
              <Skeleton className="size-6 shrink-0 rounded-full" />
              <Skeleton className="h-3 flex-1" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!members || members.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <h3 className="font-mono text-micro uppercase tracking-widest text-muted-foreground">
          Members
        </h3>
        <span className="font-mono text-micro tabular-nums text-(--color-fg-faint)">
          {members.length}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-4">
        {members.map((member) => (
          <Link
            key={member.id}
            to="/$username"
            params={{ username: member.login }}
            className={cn(
              "flex items-center gap-2 rounded-sm px-2 py-1.5",
              "outline-none transition-colors",
              "hover:bg-(--color-bg-sunken)",
              "focus-visible:bg-(--color-bg-sunken) focus-visible:ring-1 focus-visible:ring-foreground/15",
            )}
          >
            <Avatar login={member.login} avatarUrl={member.avatar_url} size="md" />
            <span className="truncate font-mono text-caption text-foreground">
              {member.login}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
