import { Check, ChevronRight, Reply, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { GithubMarkdown } from "@/app/components/GithubMarkdown";
import { Button } from "@/app/components/ui/button";
import { CommentCardDisplay } from "@/app/components/ui/CommentCard";
import { CommentComposeCard } from "@/app/components/ui/CommentComposeCard";
import {
  useDeleteReviewComment,
  useMyReviewCommentReactions,
  useReplyToReviewComment,
  useResolveThread,
  useThreadResolution,
  useToggleReviewCommentReaction,
  useUpdateReviewComment,
} from "@/app/features/pulls/hooks";
import type { ReviewComment } from "@/app/features/pulls/schemas";
import { EMPTY_MY_REACTIONS, type ReactionContent } from "@/app/features/issues/schemas";
import type { MentionUser } from "@/app/hooks/useMentionSearch";
import { useMe } from "@/app/hooks/useMe";

export type InlineThreadProps = {
  owner: string;
  repo: string;
  number: number;
  root: ReviewComment;
  replies: ReviewComment[];
};

export function InlineThread({
  owner,
  repo,
  number,
  root,
  replies,
}: InlineThreadProps) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const meQuery = useMe();
  const meId = meQuery.data?.id;
  const meLogin = meQuery.data?.login;

  const replyMutation = useReplyToReviewComment(owner, repo, number, meQuery.data);
  const toggleReaction = useToggleReviewCommentReaction(owner, repo, number, meId);
  const resolutionQuery = useThreadResolution(owner, repo, number);
  const resolveMutation = useResolveThread(owner, repo, number);

  const resolutionLoading = resolutionQuery.isLoading;
  const threadInfo = resolutionQuery.data?.get(root.id);
  const isResolved = threadInfo?.isResolved ?? false;
  const threadNodeId = threadInfo?.threadNodeId;

  const allComments = useMemo(() => [root, ...replies], [root, replies]);

  // Seed @ autocomplete with thread participants
  const participants = useMemo((): MentionUser[] => {
    const seen = new Set<string>();
    const list: MentionUser[] = [];
    for (const c of allComments) {
      if (!c.user || seen.has(c.user.login)) continue;
      seen.add(c.user.login);
      list.push({
        kind: "@",
        id: c.user.login,
        login: c.user.login,
        avatar: c.user.avatar_url,
      });
    }
    return list;
  }, [allComments]);

  function handleReply(body: string) {
    if (!body || replyMutation.isPending) return;
    // Fire-and-forget: optimistic insertion happens in onMutate, so close
    // the box immediately for instant feedback.
    replyMutation.mutate({ inReplyToId: root.id, body });
    setReplyOpen(false);
  }

  function handleResolveToggle() {
    if (!threadNodeId || resolveMutation.isPending) return;
    resolveMutation.mutate({ threadNodeId, resolve: !isResolved });
  }

  const lastComment = allComments[allComments.length - 1]!;

  if (resolutionLoading) {
    return (
      <div className="diff-line-comment diff-thread py-3 pl-4 pr-4">
        <div className="max-w-2xl">
          <div className="h-5 w-48 animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }

  // ── Resolved (collapsed) summary ────────────────────────────────────────
  if (isResolved && !expanded) {
    return (
      <div className="diff-line-comment diff-thread py-2 pl-4 pr-4 opacity-60 transition-opacity hover:opacity-100">
        <div className="max-w-2xl">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="flex items-center gap-1.5 text-caption text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronRight className="size-3.5" />
            <Check className="size-3 text-[var(--color-success)]" />
            <span>
              Resolved by{" "}
              <span className="font-medium">{lastComment.user?.login ?? "ghost"}</span>
            </span>
            <span className="text-muted-foreground/50">
              — {root.body.length > 60 ? root.body.slice(0, 60) + "…" : root.body}
            </span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="diff-line-comment diff-thread py-3 pl-4 pr-4">
      <div className="max-w-2xl">
        {isResolved && (
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_oklab,var(--color-success)_14%,transparent)] px-2 py-0.5 text-caption text-[var(--color-success)]">
            <Check className="size-3" />
            <span className="font-medium">Resolved</span>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {allComments.map((c) => (
            <ThreadComment
              key={c.id}
              owner={owner}
              repo={repo}
              number={number}
              comment={c}
              meId={meId}
              meLogin={meLogin}
              participants={participants}
              onToggleReaction={(content, existingId) =>
                toggleReaction.mutate({
                  commentId: c.id,
                  content,
                  existingReactionId: existingId,
                })
              }
            />
          ))}
        </div>

        {/* Reply / actions */}
        {replyOpen ? (
          <div className="mt-3">
            <CommentComposeCard
              login={meQuery.data?.login ?? "ghost"}
              avatarUrl={meQuery.data?.avatar_url}
              owner={owner}
              repo={repo}
              onSubmit={handleReply}
              onCancel={() => setReplyOpen(false)}
              isPending={replyMutation.isPending}
              placeholder="Reply to this thread…"
              submitLabel="Reply"
              participants={participants}
              rows={3}
              autoFocus
            />
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-1">
            <Button variant="ghost" size="xs" onClick={() => setReplyOpen(true)}>
              <Reply data-icon="inline-start" />
              Reply
            </Button>
            {threadNodeId && (
              <Button
                variant="ghost"
                size="xs"
                onClick={handleResolveToggle}
                disabled={resolveMutation.isPending}
              >
                {isResolved ? (
                  <>
                    <RotateCcw data-icon="inline-start" />
                    Unresolve
                  </>
                ) : (
                  <>
                    <Check data-icon="inline-start" />
                    Resolve
                  </>
                )}
              </Button>
            )}
            {isResolved && (
              <Button variant="ghost" size="xs" onClick={() => setExpanded(false)}>
                Collapse
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Single comment in a thread ──────────────────────────────────────────

function ThreadComment({
  owner,
  repo,
  number,
  comment,
  meId,
  meLogin,
  participants,
  onToggleReaction,
}: {
  owner: string;
  repo: string;
  number: number;
  comment: ReviewComment;
  meId: number | undefined;
  meLogin: string | undefined;
  participants: MentionUser[];
  onToggleReaction: (content: ReactionContent, existingId?: number) => void;
}) {
  const myReactionsQuery = useMyReviewCommentReactions(owner, repo, comment.id, meId);
  const myReactions = myReactionsQuery.data ?? EMPTY_MY_REACTIONS;
  const updateMutation = useUpdateReviewComment(owner, repo, number);
  const deleteMutation = useDeleteReviewComment(owner, repo, number);

  const isMine = !!meLogin && !!comment.user && meLogin === comment.user.login;

  return (
    <CommentCardDisplay
      inline
      login={comment.user?.login ?? "ghost"}
      avatarUrl={comment.user?.avatar_url}
      date={comment.created_at}
      reactions={comment.reactions}
      myReactions={myReactions}
      onToggleReaction={onToggleReaction}
      canEdit={isMine}
      rawBody={comment.body}
      onSave={async (next) => {
        await updateMutation.mutateAsync({ commentId: comment.id, body: next });
      }}
      onDelete={async () => {
        await deleteMutation.mutateAsync({ commentId: comment.id });
      }}
      participants={participants}
      repoOwner={owner}
      repoName={repo}
      isSaving={updateMutation.isPending || deleteMutation.isPending}
    >
      <div className="readme-prose max-w-none [overflow-wrap:anywhere]">
        <GithubMarkdown repoContext={{ owner, repo }}>{comment.body}</GithubMarkdown>
      </div>
    </CommentCardDisplay>
  );
}
