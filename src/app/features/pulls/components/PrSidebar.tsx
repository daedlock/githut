import { useMemo } from "react";
import { Milestone, Tag, User, UserCheck } from "lucide-react";
import { Avatar } from "@/app/components/ui/avatar";
import { ProfileLink } from "@/app/components/user/ProfileLink";
import { LabelPill } from "@/app/features/issues/components/LabelPill";
import { SidebarPicker, type PickerItem } from "@/app/features/pulls/components/SidebarPicker";
import {
  useRepoCollaborators,
  useRepoLabels,
  useSetPrAssignees,
  useSetPrLabels,
  useSetPrReviewers,
} from "@/app/features/pulls/pickers";
import type { PullRequest, Review } from "@/app/features/pulls/schemas";
import { cn } from "@/app/lib/cn";

export function PrSidebar({
  owner,
  repo,
  pr,
  reviews,
}: {
  owner: string;
  repo: string;
  pr: PullRequest;
  reviews: Review[];
}) {
  const labelsQuery = useRepoLabels(owner, repo);
  const collabQuery = useRepoCollaborators(owner, repo);

  const setReviewers = useSetPrReviewers(owner, repo, pr.number);
  const setAssignees = useSetPrAssignees(owner, repo, pr.number);
  const setLabels = useSetPrLabels(owner, repo, pr.number);

  const reviewerItems: PickerItem[] = useMemo(
    () =>
      (collabQuery.data ?? [])
        .filter((c) => c.login !== pr.user?.login)
        .map((c) => ({ id: c.login, label: c.login, avatarUrl: c.avatar_url })),
    [collabQuery.data, pr.user?.login],
  );
  const selectedReviewers = useMemo(
    () => new Set(pr.requested_reviewers.map((r) => r.login)),
    [pr.requested_reviewers],
  );
  const onToggleReviewer = (login: string, next: boolean) => {
    if (next) setReviewers.mutate({ add: [login], remove: [] });
    else setReviewers.mutate({ add: [], remove: [login] });
  };

  const assigneeItems: PickerItem[] = useMemo(
    () =>
      (collabQuery.data ?? []).map((c) => ({
        id: c.login,
        label: c.login,
        avatarUrl: c.avatar_url,
      })),
    [collabQuery.data],
  );
  const selectedAssignees = useMemo(
    () => new Set(pr.assignees.map((a) => a.login)),
    [pr.assignees],
  );
  const onToggleAssignee = (login: string, next: boolean) => {
    if (next) setAssignees.mutate({ add: [login], remove: [] });
    else setAssignees.mutate({ add: [], remove: [login] });
  };

  const labelItems: PickerItem[] = useMemo(
    () =>
      (labelsQuery.data ?? []).map((l) => ({
        id: l.name,
        label: l.name,
        description: l.description ?? undefined,
        color: l.color,
      })),
    [labelsQuery.data],
  );
  const selectedLabels = useMemo(
    () => new Set(pr.labels.map((l) => l.name)),
    [pr.labels],
  );
  const onToggleLabel = (name: string, next: boolean) => {
    const current = pr.labels.map((l) => l.name);
    const nextNames = next ? [...current, name] : current.filter((n) => n !== name);
    setLabels.mutate({ names: nextNames });
  };

  return (
    <div className="flex flex-col gap-5">
      <SidebarSection
        icon={<UserCheck className="size-3.5" />}
        title="Reviewers"
        picker={
          <SidebarPicker
            title="Request reviewers"
            ariaLabel="Edit reviewers"
            items={reviewerItems}
            selectedIds={selectedReviewers}
            onToggle={onToggleReviewer}
            loading={collabQuery.isPending}
            emptyText="No collaborators"
          />
        }
      >
        <ReviewerList pr={pr} reviews={reviews} />
      </SidebarSection>

      <SidebarSection
        icon={<User className="size-3.5" />}
        title="Assignees"
        picker={
          <SidebarPicker
            title="Assign people"
            ariaLabel="Edit assignees"
            items={assigneeItems}
            selectedIds={selectedAssignees}
            onToggle={onToggleAssignee}
            loading={collabQuery.isPending}
            emptyText="No collaborators"
          />
        }
      >
        {pr.assignees.length > 0 ? (
          <div className="flex flex-col gap-2">
            {pr.assignees.map((a) => (
              <div key={a.login} className="flex items-center gap-2">
                <Avatar login={a.login} avatarUrl={a.avatar_url} size="sm" />
                <ProfileLink login={a.login} className="text-caption text-muted-foreground">
                  {a.login}
                </ProfileLink>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState>No one assigned</EmptyState>
        )}
      </SidebarSection>

      <SidebarSection
        icon={<Tag className="size-3.5" />}
        title="Labels"
        picker={
          <SidebarPicker
            title="Apply labels"
            ariaLabel="Edit labels"
            items={labelItems}
            selectedIds={selectedLabels}
            onToggle={onToggleLabel}
            loading={labelsQuery.isPending}
            emptyText="No labels"
          />
        }
      >
        {pr.labels.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {pr.labels.map((l) => (
              <LabelPill
                key={l.id}
                label={{ id: l.id, name: l.name, color: l.color, description: l.description ?? null }}
                size="sm"
              />
            ))}
          </div>
        ) : (
          <EmptyState>None yet</EmptyState>
        )}
      </SidebarSection>

      <SidebarSection icon={<Milestone className="size-3.5" />} title="Milestone">
        {pr.milestone ? (
          <span className="text-caption text-foreground">{pr.milestone.title}</span>
        ) : (
          <EmptyState>No milestone</EmptyState>
        )}
      </SidebarSection>
    </div>
  );
}

function SidebarSection({
  icon,
  title,
  picker,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  picker?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-muted p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <span className="flex-1 text-caption font-medium text-foreground">{title}</span>
        {picker}
      </div>
      {children}
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <span className="text-caption text-muted-foreground">{children}</span>;
}

function ReviewerList({ pr, reviews }: { pr: PullRequest; reviews: Review[] }) {
  const latest = useMemo(() => {
    const byUser = new Map<string, Review>();
    const sorted = [...reviews].sort((a, b) => {
      const at = a.submitted_at ?? "";
      const bt = b.submitted_at ?? "";
      return at < bt ? -1 : at > bt ? 1 : 0;
    });
    for (const r of sorted) {
      if (r.user?.login) byUser.set(r.user.login, r);
    }
    return byUser;
  }, [reviews]);

  const people = useMemo(() => {
    const seen = new Set<string>();
    const out: Array<{ login: string; avatar_url: string }> = [];
    for (const rr of pr.requested_reviewers) {
      if (seen.has(rr.login)) continue;
      seen.add(rr.login);
      out.push(rr);
    }
    for (const r of reviews) {
      if (!r.user || seen.has(r.user.login)) continue;
      seen.add(r.user.login);
      out.push({ login: r.user.login, avatar_url: r.user.avatar_url });
    }
    return out;
  }, [pr.requested_reviewers, reviews]);

  if (people.length === 0) {
    return <EmptyState>No reviewers</EmptyState>;
  }

  return (
    <div className="flex flex-col gap-2">
      {people.map((p) => {
        const state = latest.get(p.login)?.state;
        return (
          <div key={p.login} className="flex items-center gap-2">
            <Avatar login={p.login} avatarUrl={p.avatar_url} size="sm" />
            <ProfileLink
              login={p.login}
              className="flex-1 min-w-0 truncate text-caption text-muted-foreground"
            >
              {p.login}
            </ProfileLink>
            {state && <ReviewStateBadge state={state} />}
          </div>
        );
      })}
    </div>
  );
}

function ReviewStateBadge({ state }: { state: Review["state"] }) {
  const config: Record<Review["state"], { bg: string; fg: string; label: string }> = {
    APPROVED: {
      bg: "bg-[color-mix(in_oklab,var(--color-success)_20%,transparent)]",
      fg: "text-[var(--color-success)]",
      label: "Approved",
    },
    CHANGES_REQUESTED: {
      bg: "bg-[color-mix(in_oklab,var(--color-danger)_20%,transparent)]",
      fg: "text-[var(--color-danger)]",
      label: "Changes",
    },
    COMMENTED: {
      bg: "bg-muted",
      fg: "text-muted-foreground",
      label: "Commented",
    },
    DISMISSED: {
      bg: "bg-muted",
      fg: "text-muted-foreground",
      label: "Dismissed",
    },
    PENDING: {
      bg: "bg-[color-mix(in_oklab,var(--color-warning)_20%,transparent)]",
      fg: "text-[var(--color-warning)]",
      label: "Pending",
    },
  };
  const c = config[state];
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-micro font-medium", c.bg, c.fg)}>
      {c.label}
    </span>
  );
}
