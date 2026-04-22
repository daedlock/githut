import { useMemo, useState } from "react";
import { AlertCircle, Milestone, Tag, User, UserCheck } from "lucide-react";
import { GithubMarkdown } from "@/app/components/GithubMarkdown";
import { StatusMessage } from "@/app/components/StatusMessage";
import { Avatar } from "@/app/components/ui/avatar";
import { Button } from "@/app/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader } from "@/app/components/ui/Card";
import { CommentBox } from "@/app/components/ui/CommentBox";
import { Skeleton } from "@/app/components/ui/skeleton";
import { ProfileLink } from "@/app/components/user/ProfileLink";
import { LabelPill } from "@/app/features/issues/components/LabelPill";
import { SidebarSection } from "@/app/features/issues/components/SidebarSection";
import { PrCommentCard } from "@/app/features/pulls/components/PrCommentCard";
import { PrTimelineRow } from "@/app/features/pulls/components/PrTimelineRow";
import { SidebarPicker, type PickerItem } from "@/app/features/pulls/components/SidebarPicker";
import {
  useFullPr,
  usePostPrComment,
  usePrComments,
  usePrReviews,
  usePrTimeline,
} from "@/app/features/pulls/hooks";
import { mergeTimeline, type FeedItem } from "@/app/features/pulls/lib/mergeTimeline";
import {
  useRepoCollaborators,
  useRepoLabels,
  useSetPrAssignees,
  useSetPrLabels,
  useSetPrReviewers,
} from "@/app/features/pulls/pickers";
import type { PullRequest, Review } from "@/app/features/pulls/schemas";
import { useMe } from "@/app/hooks/useMe";
import { cn } from "@/app/lib/cn";

// ─── PrConversationPage ────────────────────────────────────────────────────
//
// Body of the Conversation sub-tab. Two-column layout matching github.com:
//   main column  → PR body, interleaved feed (comments + timeline events +
//                  reviews), and the "Add a comment" box
//   sidebar      → Reviewers · Assignees · Labels · Milestone
// Sidebar is read-only in P3; pickers ship in P9.

export type PrConversationPageProps = {
  owner: string;
  repo: string;
  number: number;
};

export function PrConversationPage({ owner, repo, number }: PrConversationPageProps) {
  const prQuery = useFullPr(owner, repo, number);
  const commentsQuery = usePrComments(owner, repo, number);
  const reviewsQuery = usePrReviews(owner, repo, number);
  const timelineQuery = usePrTimeline(owner, repo, number);
  const meQuery = useMe();
  const postComment = usePostPrComment(owner, repo, number, meQuery.data);

  const [draft, setDraft] = useState("");

  const pr = prQuery.data;
  const comments = commentsQuery.data ?? [];
  const reviews = reviewsQuery.data ?? [];
  const timeline = timelineQuery.data ?? [];

  const reviewsById = useMemo(() => {
    const m = new Map<number, Review>();
    for (const r of reviews) m.set(r.id, r);
    return m;
  }, [reviews]);

  const feed = useMemo<FeedItem[]>(
    () => mergeTimeline(timeline, comments),
    [timeline, comments],
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || postComment.isPending) return;
    postComment.mutate(
      { body },
      {
        onSuccess: () => setDraft(""),
      },
    );
  }

  if (prQuery.isPending) return <ConversationSkeleton />;
  if (prQuery.isError || !pr) {
    return (
      <StatusMessage tone="danger">
        <AlertCircle className="mr-1.5 inline size-4" />
        Could not load this pull request.
      </StatusMessage>
    );
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
      {/* Main column */}
      <div className="min-w-0 flex-1 flex flex-col gap-3">
        {pr.user && (
          <PrCommentCard
            login={pr.user.login}
            avatarUrl={pr.user.avatar_url}
            date={pr.created_at}
            isAuthor
          >
            {pr.body?.trim() ? (
              <div className="readme-prose max-w-none text-body">
                <GithubMarkdown>{pr.body}</GithubMarkdown>
              </div>
            ) : (
              <p className="text-body italic text-[var(--color-fg-faint)]">
                No description provided.
              </p>
            )}
          </PrCommentCard>
        )}

        {commentsQuery.isError || timelineQuery.isError ? (
          <StatusMessage tone="danger">Could not load conversation.</StatusMessage>
        ) : feed.length === 0 &&
          (commentsQuery.isPending || timelineQuery.isPending) ? (
          <FeedSkeleton />
        ) : (
          feed.map((item, i) => {
            if (item.kind === "comment") {
              return (
                <PrCommentCard
                  key={`c-${item.id}`}
                  login={item.user?.login ?? "ghost"}
                  avatarUrl={item.user?.avatar_url}
                  date={item.at}
                >
                  <div className="readme-prose max-w-none text-body">
                    <GithubMarkdown>{item.body}</GithubMarkdown>
                  </div>
                </PrCommentCard>
              );
            }
            if (item.event === "reviewed" && typeof item.id === "number") {
              const full = reviewsById.get(item.id);
              if (full) return <ReviewCardFromFeed key={`r-${item.id}`} review={full} />;
            }
            return <PrTimelineRow key={`e-${item.id ?? i}`} event={item} />;
          })
        )}

        {meQuery.data && (
          <Card as="div" radius="md" tone="default" border="strong">
            <form onSubmit={handleSubmit}>
              <CardHeader>
                <Avatar
                  login={meQuery.data.login}
                  avatarUrl={meQuery.data.avatar_url}
                  size="sm"
                />
                <span className="text-body font-medium text-foreground">Add a comment</span>
              </CardHeader>
              <CardBody flush>
                <CommentBox
                  owner={owner}
                  repo={repo}
                  value={draft}
                  onChange={setDraft}
                  placeholder="Leave a comment"
                  rows={4}
                />
              </CardBody>
              <CardFooter className="flex justify-end">
                <Button
                  type="submit"
                  size="sm"
                  disabled={!draft.trim() || postComment.isPending}
                >
                  {postComment.isPending ? "Posting…" : "Comment"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        )}
      </div>

      {/* Sidebar */}
      <aside className="w-full lg:w-56 lg:flex-shrink-0">
        <PrSidebar owner={owner} repo={repo} pr={pr} reviews={reviews} />
      </aside>
    </div>
  );
}

// ─── Sidebar ───────────────────────────────────────────────────────────────
//
// Interactive sidebar: each section has a gear affordance that opens a
// picker popover. All mutations are optimistic — the PR detail cache is
// patched immediately, then resynced on settle so the server is the
// eventual source of truth.

function PrSidebar({
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
    <div className="flex flex-col gap-5">
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
 * SidebarSection + gear-picker trigger in one, mirroring GitHub's own
 * sidebar-header-with-affordance pattern. The picker lives inline in the
 * header (top-right) instead of creating a new chrome row.
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
      <div className="mb-2 flex items-center gap-1.5 border-b border-border pb-1.5">
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
//
// Shows requested reviewers + anyone who has actually submitted a review,
// with the latest review state shown as a status dot to the right of
// their name (GitHub parity).

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

// ─── Review card (feed) ────────────────────────────────────────────────────

function ReviewCardFromFeed({ review }: { review: Review }) {
  const tone =
    review.state === "APPROVED"
      ? "text-[var(--color-success)] bg-[color-mix(in_oklab,var(--color-success)_14%,var(--color-bg-subtle))]"
      : review.state === "CHANGES_REQUESTED"
        ? "text-[var(--color-danger)] bg-[color-mix(in_oklab,var(--color-danger)_14%,var(--color-bg-subtle))]"
        : "text-muted-foreground bg-[var(--color-bg-sunken)]";
  const label =
    review.state === "APPROVED"
      ? "Approved"
      : review.state === "CHANGES_REQUESTED"
        ? "Requested changes"
        : review.state === "COMMENTED"
          ? "Commented"
          : review.state === "DISMISSED"
            ? "Dismissed"
            : "Review";
  return (
    <PrCommentCard
      login={review.user?.login ?? "ghost"}
      avatarUrl={review.user?.avatar_url}
      date={review.submitted_at ?? new Date(0).toISOString()}
      header={
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-caption font-medium",
            tone,
          )}
        >
          {label}
        </span>
      }
    >
      {review.body?.trim() ? (
        <div className="readme-prose max-w-none text-body">
          <GithubMarkdown>{review.body}</GithubMarkdown>
        </div>
      ) : (
        <p className="text-body italic text-[var(--color-fg-faint)]">
          {label.toLowerCase()} without a comment.
        </p>
      )}
    </PrCommentCard>
  );
}

// ─── Skeletons ─────────────────────────────────────────────────────────────

function ConversationSkeleton() {
  return (
    <div className="skeleton-fade flex flex-col gap-3">
      {[80, 64, 72].map((w) => (
        <div
          key={w}
          className="rounded-md border border-border bg-background p-4"
        >
          <div className="mb-3 flex items-center gap-2">
            <Skeleton className="size-6 rounded-full" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-3" style={{ width: `${w}%` }} />
          <Skeleton className="mt-2 h-3 w-5/6" />
        </div>
      ))}
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="skeleton-fade flex flex-col gap-3">
      {[60, 45].map((w) => (
        <div key={w} className="flex items-center gap-2 pl-2">
          <Skeleton className="size-3.5 rounded-full" />
          <Skeleton className="h-3" style={{ width: `${w}%` }} />
        </div>
      ))}
    </div>
  );
}
