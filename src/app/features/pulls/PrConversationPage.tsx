import { AlertCircle, Check, EyeOff, GitMerge, MessageSquare, X } from "lucide-react";
import { useMemo } from "react";
import { GithubMarkdown } from "@/app/components/GithubMarkdown";
import { StatusMessage } from "@/app/components/StatusMessage";
import { CommentCardDisplay, CommentComposeCard } from "@/app/components/ui/CommentCard";
import { CommentSkeleton } from "@/app/components/ui/CommentSkeleton";
import { Skeleton, SkeletonGroup } from "@/app/components/ui/skeleton";
import type { ReactionContent } from "@/app/features/issues/schemas";
import { PrMergeBox } from "@/app/features/pulls/components/PrMergeBox";
import { PrCommitGroupRow, PrTimelineRow } from "@/app/features/pulls/components/PrTimelineRow";
import { ReviewCard } from "@/app/features/pulls/components/ReviewCard";
import {
  useDeletePrComment,
  useFullPr,
  useMyPrCommentReactions,
  usePostPrComment,
  usePrComments,
  usePrCommits,
  usePrReviewComments,
  usePrReviews,
  usePrTimeline,
  useTogglePrCommentReaction,
  useUpdatePr,
  useUpdatePrComment,
} from "@/app/features/pulls/hooks";
import { type FeedItem, mergeTimeline } from "@/app/features/pulls/lib/mergeTimeline";
import type { Review, ReviewComment } from "@/app/features/pulls/schemas";
import { useMe } from "@/app/hooks/useMe";
import type { MentionUser } from "@/app/hooks/useMentionSearch";
import { cn } from "@/app/lib/cn";
import { draftKey, draftPage } from "@/app/stores/drafts";

export type PrConversationPageProps = {
  owner: string;
  repo: string;
  number: number;
};

export function PrConversationPage({ owner, repo, number }: PrConversationPageProps) {
  const prQuery = useFullPr(owner, repo, number);
  const commentsQuery = usePrComments(owner, repo, number);
  const reviewsQuery = usePrReviews(owner, repo, number);
  const reviewCommentsQuery = usePrReviewComments(owner, repo, number);
  const timelineQuery = usePrTimeline(owner, repo, number);
  const commitsQuery = usePrCommits(owner, repo, number);
  const meQuery = useMe();
  const postComment = usePostPrComment(owner, repo, number, meQuery.data);
  const updatePr = useUpdatePr(owner, repo, number);

  const pr = prQuery.data;
  const comments = commentsQuery.data ?? [];
  const reviews = reviewsQuery.data ?? [];
  const reviewComments = reviewCommentsQuery.data ?? [];
  const timeline = timelineQuery.data ?? [];
  const commits = commitsQuery.data ?? [];

  const inlineByReviewId = useMemo(() => {
    const m = new Map<number, ReviewComment[]>();
    // Two-pass:
    //   1) Index roots by review id, replies by their root id (regardless of
    //      which review the reply itself was posted in)
    //   2) For each review's roots, append all replies (from any review) so
    //      the original review card shows the full thread
    const rootsByReview = new Map<number, ReviewComment[]>();
    const repliesByRoot = new Map<number, ReviewComment[]>();
    for (const c of reviewComments) {
      if (c.in_reply_to_id != null) {
        const arr = repliesByRoot.get(c.in_reply_to_id) ?? [];
        arr.push(c);
        repliesByRoot.set(c.in_reply_to_id, arr);
      } else if (c.pull_request_review_id != null) {
        const arr = rootsByReview.get(c.pull_request_review_id) ?? [];
        arr.push(c);
        rootsByReview.set(c.pull_request_review_id, arr);
      }
    }
    for (const [reviewId, roots] of rootsByReview) {
      const all: ReviewComment[] = [];
      for (const root of roots) {
        all.push(root);
        const replies = repliesByRoot.get(root.id) ?? [];
        all.push(...replies);
      }
      m.set(reviewId, all);
    }
    return m;
  }, [reviewComments]);

  const feed = useMemo<FeedItem[]>(
    () => mergeTimeline(timeline, comments, reviews, commits),
    [timeline, comments, reviews, commits],
  );

  const participants = useMemo((): MentionUser[] => {
    const seen = new Set<string>();
    const users: MentionUser[] = [];
    const add = (u: { login: string; avatar_url: string } | null | undefined) => {
      if (!u || seen.has(u.login)) return;
      seen.add(u.login);
      users.push({ kind: "@", id: u.login, login: u.login, avatar: u.avatar_url });
    };
    add(pr?.user);
    for (const c of comments) add(c.user);
    for (const r of reviews) add(r.user);
    return users;
  }, [pr, comments, reviews]);

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
              canEdit={!!meQuery.data && meQuery.data.login === pr.user.login}
              rawBody={pr.body ?? ""}
              onSave={async (next) => {
                await updatePr.mutateAsync({ body: next });
              }}
              participants={participants}
              repoOwner={owner}
              repoName={repo}
              isSaving={updatePr.isPending}
            >
              {pr.body?.trim() ? (
                <div className="readme-prose max-w-none text-sm">
                  <GithubMarkdown repoContext={{ owner, repo }}>{pr.body}</GithubMarkdown>
                </div>
              ) : (
                <p className="text-sm italic text-muted-foreground">No description provided.</p>
              )}
            </CommentCardDisplay>
          </div>
        </div>
      )}

      {/* Feed */}
      {commentsQuery.isError || timelineQuery.isError || commitsQuery.isError ? (
        <StatusMessage tone="danger">Could not load conversation.</StatusMessage>
      ) : feed.length === 0 &&
        (commentsQuery.isPending || timelineQuery.isPending || commitsQuery.isPending) ? (
        <FeedSkeleton />
      ) : (
        <div className="flex flex-col">
          {feed.map((item, i) => {
            if (item.kind === "commitGroup") {
              return <PrCommitGroupRow key={`cg-${item.at}-${item.commits.length}`} item={item} />;
            }
            if (item.kind === "comment") {
              return (
                <PrCommentRow
                  key={`c-${item.id}`}
                  item={item}
                  owner={owner}
                  repo={repo}
                  number={number}
                  meId={meQuery.data?.id}
                  meLogin={meQuery.data?.login}
                  participants={participants}
                />
              );
            }
            if (item.kind === "review") {
              const inline = inlineByReviewId.get(item.review.id) ?? [];
              // Reply-only reviews (no body, no new root threads) are noise:
              // their replies are already visible under their parent thread
              // in the original review card. Skip rendering entirely.
              const hasBody = !!item.review.body?.trim();
              const hasNewThreads = inline.some((c) => !c.in_reply_to_id);
              if (!hasBody && !hasNewThreads) return null;
              return (
                <div key={`r-${item.review.id}`} className="relative flex gap-4 pt-4">
                  <div className="pt-1">
                    <TimelineMarker type="review" reviewState={item.review.state} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <ReviewCard
                      review={item.review}
                      inlineComments={inline}
                      owner={owner}
                      repo={repo}
                      number={number}
                    />
                  </div>
                </div>
              );
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
              participants={participants}
              draftKey={draftKey(draftPage(owner, repo, number), "comment")}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Review card ────────────────────────────────────────────────────────────

function PrCommentRow({
  item,
  owner,
  repo,
  number,
  meId,
  meLogin,
  participants,
}: {
  item: FeedItem & { kind: "comment" };
  owner: string;
  repo: string;
  number: number;
  meId: number | undefined;
  meLogin: string | undefined;
  participants?: MentionUser[];
}) {
  const myReactions = useMyPrCommentReactions(owner, repo, item.id, meId);
  const toggleReaction = useTogglePrCommentReaction(owner, repo, number, meId);
  const updateComment = useUpdatePrComment(owner, repo, number);
  const deleteComment = useDeletePrComment(owner, repo, number);

  const handleToggle = (content: ReactionContent, existingReactionId?: number) => {
    toggleReaction.mutate({ commentId: item.id, content, existingReactionId });
  };

  const isMine = !!meLogin && !!item.user && meLogin === item.user.login;

  return (
    <div className="relative flex gap-4 pt-4">
      <div className="pt-1">
        <TimelineMarker type="comment" avatarUrl={item.user?.avatar_url} />
      </div>
      <div className="min-w-0 flex-1">
        <CommentCardDisplay
          login={item.user?.login ?? "ghost"}
          avatarUrl={item.user?.avatar_url}
          date={item.at}
          reactions={item.reactions}
          myReactions={myReactions.data}
          onToggleReaction={handleToggle}
          canEdit={isMine}
          rawBody={item.body}
          onSave={async (next) => {
            await updateComment.mutateAsync({ commentId: item.id, body: next });
          }}
          onDelete={async () => {
            await deleteComment.mutateAsync({ commentId: item.id });
          }}
          participants={participants}
          repoOwner={owner}
          repoName={repo}
          isSaving={updateComment.isPending || deleteComment.isPending}
        >
          <div className="readme-prose max-w-none text-sm">
            <GithubMarkdown repoContext={{ owner, repo }}>{item.body}</GithubMarkdown>
          </div>
        </CommentCardDisplay>
      </div>
    </div>
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
    const Icon =
      props.reviewState === "APPROVED"
        ? Check
        : props.reviewState === "CHANGES_REQUESTED"
          ? X
          : props.reviewState === "DISMISSED"
            ? EyeOff
            : MessageSquare;
    const fg =
      props.reviewState === "APPROVED"
        ? "text-[var(--color-success)]"
        : props.reviewState === "CHANGES_REQUESTED"
          ? "text-[var(--color-danger)]"
          : "text-muted-foreground";
    const ring =
      props.reviewState === "APPROVED"
        ? "ring-[color-mix(in_oklab,var(--color-success)_45%,transparent)]"
        : props.reviewState === "CHANGES_REQUESTED"
          ? "ring-[color-mix(in_oklab,var(--color-danger)_45%,transparent)]"
          : "ring-border";
    return (
      <div
        className={cn(
          "relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full bg-background ring-2",
          ring,
        )}
      >
        <Icon className={cn("size-3", fg)} strokeWidth={2.5} />
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
    <div className="space-y-4">
      <CommentSkeleton label="Loading pull request description" />
      <CommentSkeleton label="Loading conversation" />
    </div>
  );
}

function FeedSkeleton() {
  return (
    <SkeletonGroup label="Loading conversation" className="skeleton-fade flex flex-col gap-3">
      {[60, 45].map((w) => (
        <div key={w} className="flex items-center gap-2 pl-2">
          <Skeleton className="size-3.5 rounded-full" />
          <Skeleton className="h-3" style={{ width: `${w}%` }} />
        </div>
      ))}
    </SkeletonGroup>
  );
}
