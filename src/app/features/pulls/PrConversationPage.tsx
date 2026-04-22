import { useMemo, useState } from "react";
import { AlertCircle } from "lucide-react";
import { GithubMarkdown } from "@/app/components/GithubMarkdown";
import { StatusMessage } from "@/app/components/StatusMessage";
import { Avatar } from "@/app/components/ui/avatar";
import { Button } from "@/app/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader } from "@/app/components/ui/Card";
import { CommentBox } from "@/app/components/ui/CommentBox";
import { Skeleton } from "@/app/components/ui/skeleton";
import { PrCommentCard } from "@/app/features/pulls/components/PrCommentCard";
import { PrTimelineRow } from "@/app/features/pulls/components/PrTimelineRow";
import {
  useFullPr,
  usePostPrComment,
  usePrComments,
  usePrReviews,
  usePrTimeline,
} from "@/app/features/pulls/hooks";
import { mergeTimeline, type FeedItem } from "@/app/features/pulls/lib/mergeTimeline";
import type { Review } from "@/app/features/pulls/schemas";
import { useMe } from "@/app/hooks/useMe";
import { cn } from "@/app/lib/cn";

// ─── PrConversationPage ────────────────────────────────────────────────────
//
// Body of the Conversation sub-tab. Composed of four parts, top-to-bottom:
//   1) PR body (as a comment card from the author)
//   2) Interleaved feed — issue comments + timeline events (reviews surface
//      as timeline `reviewed` entries; their bodies are rendered inline
//      via the reviews cache so we can show the full markdown).
//   3) Add-a-comment box (optimistic)
//
// The Conversation/Files/Commits/Checks sub-tab shell is owned by the
// parent route — this component renders below that `<Outlet/>`.

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

  // Map of review id → review so the feed can render review bodies inline.
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
    <div className="flex flex-col gap-3">
      {/* PR body */}
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

      {/* Feed */}
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
          // kind === "event"
          // Review events surface a separate card (body + state pill); all
          // other events render as single-line timeline rows.
          if (item.event === "reviewed" && typeof item.id === "number") {
            const full = reviewsById.get(item.id);
            if (full) return <ReviewCardFromFeed key={`r-${item.id}`} review={full} />;
          }
          return <PrTimelineRow key={`e-${item.id ?? i}`} event={item} />;
        })
      )}

      {/* Add a comment */}
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
  );
}

// ─── Review card ───────────────────────────────────────────────────────────
//
// Renders a submitted review's body + state pill. We show "Approved" /
// "Changes requested" / "Commented" inline since the state is part of the
// review's meaning, not just decoration.

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
