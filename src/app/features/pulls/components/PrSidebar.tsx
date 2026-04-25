import { useMemo } from "react";
import { Milestone, Tag, User, UserCheck } from "lucide-react";
import { Avatar } from "@/app/components/ui/avatar";
import { ProfileLink } from "@/app/components/user/ProfileLink";
import { LabelPill } from "@/app/features/issues/components/LabelPill";
import { SidebarSection } from "@/app/features/issues/components/SidebarSection";
import { SidebarPicker, type PickerItem } from "@/app/features/pulls/components/SidebarPicker";
import {
  useRepoCollaborators,
  useRepoLabels,
  useSetPrAssignees,
  useSetPrLabels,
  useSetPrReviewers,
} from "@/app/features/pulls/pickers";
import type { PullRequest, Review } from "@/app/features/pulls/schemas";

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

  // ─── Reviewers ────────────────────────────────────────────────────────────
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

  // ─── Assignees ────────────────────────────────────────────────────────────
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

  // ─── Labels ───────────────────────────────────────────────────────────────
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
    const nextNames = next
      ? [...current, name]
      : current.filter((n) => n !== name);
    setLabels.mutate({ names: nextNames });
  };

  return (
    <div className="flex flex-col gap-6">
      <PickerSection
        icon={<UserCheck className="size-3.5" />}
        title="Reviewers"
        picker={
          <SidebarPicker
            title="Request up to 15 reviewers"
            ariaLabel="Edit reviewers"
            items={reviewerItems}
            selectedIds={selectedReviewers}
            onToggle={onToggleReviewer}
            loading={collabQuery.isPending}
            emptyText="No collaborators available"
          />
        }
      >
        <ReviewerList pr={pr} reviews={reviews} />
      </PickerSection>

      <PickerSection
        icon={<User className="size-3.5" />}
        title="Assignees"
        picker={
          <SidebarPicker
            title="Assign up to 10 people"
            ariaLabel="Edit assignees"
            items={assigneeItems}
            selectedIds={selectedAssignees}
            onToggle={onToggleAssignee}
            loading={collabQuery.isPending}
            emptyText="No collaborators available"
          />
        }
      >
        {pr.assignees.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {pr.assignees.map((a) => (
              <div key={a.login} className="flex items-center gap-2">
                <Avatar login={a.login} avatarUrl={a.avatar_url} size="sm" />
                <ProfileLink
                  login={a.login}
                  className="text-caption text-muted-foreground"
                >
                  {a.login}
                </ProfileLink>
              </div>
            ))}
          </div>
        ) : (
          <span className="text-caption text-[var(--color-fg-faint)]">
            No one assigned
          </span>
        )}
      </PickerSection>

      <PickerSection
        icon={<Tag className="size-3.5" />}
        title="Labels"
        picker={
          <SidebarPicker
            title="Apply labels to this pull request"
            ariaLabel="Edit labels"
            items={labelItems}
            selectedIds={selectedLabels}
            onToggle={onToggleLabel}
            loading={labelsQuery.isPending}
            emptyText="No labels in this repo"
          />
        }
      >
        {pr.labels.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {pr.labels.map((l) => (
              <LabelPill
                key={l.id}
                label={{
                  id: l.id,
                  name: l.name,
                  color: l.color,
                  description: l.description ?? null,
                }}
                size="sm"
              />
            ))}
          </div>
        ) : (
          <span className="text-caption text-[var(--color-fg-faint)]">
            None yet
          </span>
        )}
      </PickerSection>

      <SidebarSection icon={<Milestone className="size-3.5" />} title="Milestone">
        {pr.milestone ? (
          <span className="text-caption text-muted-foreground">
            {pr.milestone.title}
          </span>
        ) : (
          <span className="text-caption text-[var(--color-fg-faint)]">
            No milestone
          </span>
        )}
      </SidebarSection>
    </div>
  );
}

/**
 * Sidebar section with gear-picker trigger.
 * No borders — spacing separates sections.
 */
function PickerSection({
  icon,
  title,
  picker,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  picker: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5">
        <span className="text-[var(--color-fg-faint)]">{icon}</span>
        <span className="flex-1 font-mono text-micro font-medium uppercase tracking-widest text-[var(--color-fg-faint)]">
          {title}
        </span>
        {picker}
      </div>
      {children}
    </div>
  );
}

// ─── Reviewers list ────────────────────────────────────────────────────────

function ReviewerList({ pr, reviews }: { pr: PullRequest; reviews: Review[] }) {
  // login → latest review state (by submitted_at).
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

  // Union of requested reviewers + reviewers who already submitted.
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
    return <span className="text-caption text-[var(--color-fg-faint)]">None yet</span>;
  }

  return (
    <div className="flex flex-col gap-1.5">
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
            {state && <ReviewStateDot state={state} />}
          </div>
        );
      })}
    </div>
  );
}

function ReviewStateDot({ state }: { state: Review["state"] }) {
  const map: Record<Review["state"], { tone: string; label: string }> = {
    APPROVED: {
      tone: "bg-[var(--color-success)]",
      label: "Approved",
    },
    CHANGES_REQUESTED: {
      tone: "bg-[var(--color-danger)]",
      label: "Changes requested",
    },
    COMMENTED: { tone: "bg-[var(--color-fg-faint)]", label: "Commented" },
    DISMISSED: { tone: "bg-[var(--color-fg-faint)]", label: "Dismissed" },
    PENDING: { tone: "bg-[var(--color-warning)]", label: "Pending" },
  };
  const s = map[state];
  return (
    <span
      title={s.label}
      aria-label={s.label}
      className={cn("size-2 rounded-full shrink-0", s.tone)}
    />
  );
}

import { cn } from "@/app/lib/cn";
