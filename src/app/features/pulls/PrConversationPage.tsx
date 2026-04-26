import { useMemo } from "react";
import { AlertCircle, GitMerge } from "lucide-react";
import { GithubMarkdown } from "@/app/components/GithubMarkdown";
import { StatusMessage } from "@/app/components/StatusMessage";
import { CommentCardDisplay, CommentComposeCard } from "@/app/components/ui/CommentCard";
import { Skeleton } from "@/app/components/ui/skeleton";
import { PrMergeBox } from "@/app/features/pulls/components/PrMergeBox";
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

  function handleSubmit(body: string) {
    if (!body || postComment.isPending) return;
    postComment.mutate({ body });
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
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-[11px] top-0 bottom-0 w-0.5 bg-muted" />

      {/* PR body */}
      {pr.user && (
        <div className="relative flex gap-4">
          <div className="pt-1">
            <TimelineMarker type="author" avatarUrl={pr.user.avatar_url} />
          </div>
          <div className="min-w-0 flex-1">
            <CommentCardDisplay
              login={pr.user.login}
              avatarUrl={pr.user.avatar_url}
              date={pr.created_at}
              isAuthor
            >
              {pr.body?.trim() ? (
                <div className="readme-prose max-w-none text-sm">
                  <GithubMarkdown repoContext={{ owner, repo }}>{pr.body}</GithubMarkdown>
                </div>
              ) : (
                <p className="text-sm italic text-muted-foreground">
                  No description provided.
                </p>
              )}
            </CommentCardDisplay>
          </div>
        </div>
      )}

      {/* Feed */}
      {commentsQuery.isError || timelineQuery.isError ? (
        <StatusMessage tone="danger">Could not load conversation.</StatusMessage>
      ) : feed.length === 0 && (commentsQuery.isPending || timelineQuery.isPending) ? (
        <FeedSkeleton />
      ) : (
        <div className="flex flex-col">
          {feed.map((item, i) => {
            if (item.kind === "comment") {
              return (
                <div key={`c-${item.id}`} className="relative flex gap-4 pt-4">
                  <div className="pt-1">
                    <TimelineMarker type="comment" avatarUrl={item.user?.avatar_url} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <CommentCardDisplay
                      login={item.user?.login ?? "ghost"}
                      avatarUrl={item.user?.avatar_url}
                      date={item.at}
                    >
                      <div className="readme-prose max-w-none text-sm">
                        <GithubMarkdown repoContext={{ owner, repo }}>{item.body}</GithubMarkdown>
                      </div>
                    </CommentCardDisplay>
                  </div>
                </div>
              );
            }
            if (item.event === "reviewed" && typeof item.id === "number") {
              const full = reviewsById.get(item.id);
              if (full) {
                return (
                  <div key={`r-${item.id}`} className="relative flex gap-4 pt-4">
                    <div className="pt-1">
                      <TimelineMarker type="review" reviewState={full.state} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <ReviewCard review={full} owner={owner} repo={repo} />
                    </div>
                  </div>
                );
              }
            }
            return (
              <div key={`e-${item.id ?? i}`} className="relative">
                <PrTimelineRow event={item} />
              </div>
            );
          })}
        </div>
      )}

      {/* Merge status box */}
      <div className="relative flex gap-4 pt-4">
        <div className="pt-1">
          <TimelineMarker type="merge" />
        </div>
        <div className="min-w-0 flex-1">
          <PrMergeBox owner={owner} repo={repo} pr={pr} />
        </div>
      </div>

      {/* Add a comment */}
      {meQuery.data && (
        <div className="relative flex gap-4 pt-4">
          <div className="pt-1">
            <TimelineMarker type="comment" avatarUrl={meQuery.data.avatar_url} />
          </div>
          <div className="min-w-0 flex-1">
            <CommentComposeCard
              login={meQuery.data.login}
              avatarUrl={meQuery.data.avatar_url}
              owner={owner}
              repo={repo}
              onSubmit={handleSubmit}
              isPending={postComment.isPending}
              placeholder="Leave a comment"
              submitLabel="Comment"
              hideAvatar
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Review card ────────────────────────────────────────────────────────────

function ReviewCard({ review, owner, repo }: { review: Review; owner: string; repo: string }) {
  const tone =
    review.state === "APPROVED"
      ? "text-[var(--color-success)] bg-[color-mix(in_oklab,var(--color-success)_14%,var(--color-bg-subtle))]"
      : review.state === "CHANGES_REQUESTED"
        ? "text-[var(--color-danger)] bg-[color-mix(in_oklab,var(--color-danger)_14%,var(--color-bg-subtle))]"
        : "text-muted-foreground bg-muted";
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
    <CommentCardDisplay
      login={review.user?.login ?? "ghost"}
      avatarUrl={review.user?.avatar_url}
      date={review.submitted_at ?? new Date(0).toISOString()}
      actions={
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
            tone,
          )}
        >
          {label}
        </span>
      }
    >
      {review.body?.trim() ? (
        <div className="readme-prose max-w-none text-sm">
          <GithubMarkdown repoContext={{ owner, repo }}>{review.body}</GithubMarkdown>
        </div>
      ) : (
        <p className="text-sm italic text-muted-foreground">
          {label.toLowerCase()} without a comment.
        </p>
      )}
    </CommentCardDisplay>
  );
}

// ─── Timeline Marker ────────────────────────────────────────────────────────

type TimelineMarkerProps =
  | { type: "author" | "comment"; avatarUrl?: string }
  | { type: "review"; reviewState: Review["state"] }
  | { type: "merge" };

function TimelineMarker(props: TimelineMarkerProps) {
  if (props.type === "author" || props.type === "comment") {
    return (
      <div className="relative z-10 shrink-0">
        {props.avatarUrl ? (
          <img
            src={props.avatarUrl}
            alt=""
            className="size-6 rounded-full bg-background ring-2 ring-background"
          />
        ) : (
          <div className="size-6 rounded-full bg-muted ring-2 ring-background" />
        )}
      </div>
    );
  }

  if (props.type === "review") {
    const tone =
      props.reviewState === "APPROVED"
        ? "bg-[var(--color-success)]"
        : props.reviewState === "CHANGES_REQUESTED"
          ? "bg-[var(--color-danger)]"
          : "bg-muted-foreground";
    return (
      <div className="relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full bg-background ring-2 ring-background">
        <div className={cn("size-3 rounded-full", tone)} />
      </div>
    );
  }

  // merge
  return (
    <div className="relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-pr-merged)] ring-2 ring-background">
      <GitMerge className="size-3 text-white" />
    </div>
  );
}

// ─── Skeletons ─────────────────────────────────────────────────────────────

function ConversationSkeleton() {
  return (
    <div className="skeleton-fade flex flex-col gap-3">
      {[80, 64, 72].map((w) => (
        <div key={w} className="rounded-lg bg-muted p-4">
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
