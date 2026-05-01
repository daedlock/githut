import { AnimatePresence, motion } from "framer-motion";
import { Milestone, Tag, User, UserCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { Avatar } from "@/app/components/ui/avatar";
import { Card } from "@/app/components/ui/card";
import { ProfileLink } from "@/app/components/user/ProfileLink";
import { LabelPill } from "@/app/features/issues/components/LabelPill";
import { type PickerItem, SidebarPicker } from "@/app/features/pulls/components/SidebarPicker";
import {
  knownReviewerItemsForQuery,
  reviewerAvatarForLogin,
  reviewerDisplayLogin,
  reviewerLoginForInput,
  useGitHubUserSearch,
  useRepoCollaborators,
  useRepoLabels,
  useSetPrAssignees,
  useSetPrLabels,
  useSetPrReviewers,
} from "@/app/features/pulls/pickers";
import type { PullRequest, Review } from "@/app/features/pulls/schemas";
import { cn } from "@/app/lib/cn";

// Snappy spring with a touch of overshoot — items pop in/out cleanly.
const ITEM_SPRING = { type: "spring" as const, stiffness: 540, damping: 30, mass: 0.5 };
const ITEM_INIT = { opacity: 0, scale: 0.85, y: -2 };
const ITEM_IN = { opacity: 1, scale: 1, y: 0 };
const ITEM_OUT = { opacity: 0, scale: 0.85, y: -2 };

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
  const [reviewerQuery, setReviewerQuery] = useState("");
  const reviewerSearchQuery = useGitHubUserSearch(reviewerQuery);

  const setReviewers = useSetPrReviewers(owner, repo, pr.number, pr.node_id);
  const setAssignees = useSetPrAssignees(owner, repo, pr.number);
  const setLabels = useSetPrLabels(owner, repo, pr.number);

  const reviewerItems: PickerItem[] = useMemo(() => {
    const items = new Map<string, PickerItem>();
    const addItem = (item: PickerItem) => {
      if (item.id === pr.user?.login || items.has(item.id)) return;
      items.set(item.id, item);
    };

    for (const actor of knownReviewerItemsForQuery(reviewerQuery)) {
      addItem(actor);
    }
    for (const reviewer of pr.requested_reviewers) {
      const login = reviewerDisplayLogin(reviewer.login);
      addItem({ id: login, label: login, avatarUrl: reviewerAvatarForLogin(reviewer.login) });
    }
    for (const collaborator of collabQuery.data ?? []) {
      addItem({
        id: collaborator.login,
        label: collaborator.login,
        avatarUrl: collaborator.avatar_url,
      });
    }
    for (const user of reviewerSearchQuery.data ?? []) {
      if (user.type === "Organization") continue;
      addItem({ id: user.login, label: user.login, avatarUrl: user.avatar_url });
    }

    const custom = reviewerLoginForInput(reviewerQuery);
    if (custom) {
      addItem({ id: custom, label: custom, avatarUrl: reviewerAvatarForLogin(custom) });
    }

    return [...items.values()];
  }, [
    collabQuery.data,
    pr.requested_reviewers,
    pr.user?.login,
    reviewerQuery,
    reviewerSearchQuery.data,
  ]);
  const selectedReviewers = useMemo(() => {
    const selected = new Set<string>();
    for (const reviewer of pr.requested_reviewers) {
      selected.add(reviewer.login);
      selected.add(reviewerDisplayLogin(reviewer.login));
    }
    return selected;
  }, [pr.requested_reviewers]);
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
  const selectedLabels = useMemo(() => new Set(pr.labels.map((l) => l.name)), [pr.labels]);
  const onToggleLabel = (name: string, next: boolean) => {
    const current = pr.labels.map((l) => l.name);
    const nextNames = next ? [...current, name] : current.filter((n) => n !== name);
    setLabels.mutate({ names: nextNames });
  };

  return (
    <div className="flex flex-col gap-4">
      <Card variant="muted" className="p-3">
        <SectionHeader
          icon={<UserCheck className="size-3" />}
          title="Reviewers"
          picker={
            <SidebarPicker
              title="Request reviewers"
              ariaLabel="Edit reviewers"
              items={reviewerItems}
              selectedIds={selectedReviewers}
              onToggle={onToggleReviewer}
              loading={collabQuery.isPending && reviewerItems.length === 0}
              emptyText="No matching reviewers"
              onQueryChange={setReviewerQuery}
            />
          }
        />
        <div className="mt-2">
          <ReviewerList pr={pr} reviews={reviews} />
        </div>
      </Card>

      <Card variant="muted" className="p-3">
        <SectionHeader
          icon={<User className="size-3" />}
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
        />
        <div className="mt-2">
          {pr.assignees.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <AnimatePresence mode="popLayout" initial={false}>
                {pr.assignees.map((a) => (
                  <motion.div
                    key={a.login}
                    layout
                    initial={ITEM_INIT}
                    animate={ITEM_IN}
                    exit={ITEM_OUT}
                    transition={ITEM_SPRING}
                    className="flex items-center gap-2"
                  >
                    <Avatar login={a.login} avatarUrl={a.avatar_url} size="sm" />
                    <ProfileLink login={a.login} className="text-xs text-muted-foreground">
                      {a.login}
                    </ProfileLink>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <EmptyState>No one assigned</EmptyState>
          )}
        </div>
      </Card>

      <Card variant="muted" className="p-3">
        <SectionHeader
          icon={<Tag className="size-3" />}
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
        />
        <div className="mt-2">
          {pr.labels.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              <AnimatePresence mode="popLayout" initial={false}>
                {pr.labels.map((l) => (
                  <motion.div
                    key={l.id}
                    layout
                    initial={ITEM_INIT}
                    animate={ITEM_IN}
                    exit={ITEM_OUT}
                    transition={ITEM_SPRING}
                  >
                    <LabelPill
                      label={{
                        id: l.id,
                        name: l.name,
                        color: l.color,
                        description: l.description ?? null,
                      }}
                      size="sm"
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <EmptyState>None yet</EmptyState>
          )}
        </div>
      </Card>

      <Card variant="muted" className="p-3">
        <SectionHeader icon={<Milestone className="size-3" />} title="Milestone" />
        <div className="mt-2">
          {pr.milestone ? (
            <span className="text-xs text-foreground">{pr.milestone.title}</span>
          ) : (
            <EmptyState>No milestone</EmptyState>
          )}
        </div>
      </Card>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  picker,
}: {
  icon: React.ReactNode;
  title: string;
  picker?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex-1 text-xs font-medium text-muted-foreground">{title}</span>
      {picker}
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <span className="text-xs text-muted-foreground">{children}</span>;
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
    <div className="flex flex-col gap-1.5">
      <AnimatePresence mode="popLayout" initial={false}>
        {people.map((p) => {
          const state = latest.get(p.login)?.state;
          return (
            <motion.div
              key={p.login}
              layout
              initial={ITEM_INIT}
              animate={ITEM_IN}
              exit={ITEM_OUT}
              transition={ITEM_SPRING}
              className="flex items-center gap-2"
            >
              <Avatar login={p.login} avatarUrl={p.avatar_url} size="sm" />
              <ProfileLink
                login={p.login}
                className="flex-1 min-w-0 truncate text-xs text-muted-foreground"
              >
                {p.login}
              </ProfileLink>
              {state && <ReviewStateBadge state={state} />}
            </motion.div>
          );
        })}
      </AnimatePresence>
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
    <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", c.bg, c.fg)}>{c.label}</span>
  );
}
