import { Check, ChevronRight, Reply, RotateCcw, Send } from "lucide-react";
import { useRef, useState } from "react";
import { GithubMarkdown } from "@/app/components/GithubMarkdown";
import { Avatar } from "@/app/components/ui/avatar";
import { Button } from "@/app/components/ui/button";
import { ReactionsBar } from "@/app/features/issues/components/ReactionsBar";
import {
  useMyReviewCommentReactions,
  useReplyToReviewComment,
  useResolveThread,
  useThreadResolution,
  useToggleReviewCommentReaction,
} from "@/app/features/pulls/hooks";
import type { ReviewComment } from "@/app/features/pulls/schemas";
import { EMPTY_MY_REACTIONS, type ReactionContent } from "@/app/features/issues/schemas";
import { reactionsHaveAny } from "@/app/features/issues/utils";
import { useMe } from "@/app/hooks/useMe";
import { formatRelativeTime } from "@/app/lib/time";

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
  const [body, setBody] = useState("");
  const [expanded, setExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const replyMutation = useReplyToReviewComment(owner, repo, number);
  const meQuery = useMe();
  const meId = meQuery.data?.id;
  const toggleReaction = useToggleReviewCommentReaction(owner, repo, number, meId);

  const resolutionQuery = useThreadResolution(owner, repo, number);
  const resolveMutation = useResolveThread(owner, repo, number);
  const resolutionLoading = resolutionQuery.isLoading;
  const threadInfo = resolutionQuery.data?.get(root.id);
  const isResolved = threadInfo?.isResolved ?? false;
  const threadNodeId = threadInfo?.threadNodeId;

  function handleReply() {
    const text = body.trim();
    if (!text || replyMutation.isPending) return;
    replyMutation.mutate(
      { inReplyToId: root.id, body: text },
      { onSuccess: () => { setBody(""); setReplyOpen(false); } },
    );
  }

  function handleResolveToggle() {
    if (!threadNodeId || resolveMutation.isPending) return;
    resolveMutation.mutate({ threadNodeId, resolve: !isResolved });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleReply();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setReplyOpen(false);
      setBody("");
    }
  }

  const allComments = [root, ...replies];
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

  if (isResolved && !expanded) {
    return (
      <div className="diff-line-comment diff-thread py-2 pl-4 pr-4 opacity-60">
        <div className="max-w-2xl">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="flex items-center gap-1.5 text-caption text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronRight className="size-3.5" />
            <Check className="size-3 text-[var(--color-success)]" />
            <span>Resolved by <span className="font-medium">{lastComment.user?.login ?? "ghost"}</span></span>
            <span className="text-muted-foreground/50">— {root.body.length > 60 ? root.body.slice(0, 60) + "…" : root.body}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="diff-line-comment diff-thread py-3 pl-4 pr-4">
      <div className="max-w-2xl">
        {isResolved && (
          <div className="mb-2 flex items-center gap-1.5 text-caption text-[var(--color-success)]">
            <Check className="size-3" />
            <span>Resolved</span>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {allComments.map((c) => (
            <CommentBubble
              key={c.id}
              comment={c}
              owner={owner}
              repo={repo}
              meId={meId}
              onToggleReaction={(content, existingId) =>
                toggleReaction.mutate({ commentId: c.id, content, existingReactionId: existingId })
              }
            />
          ))}
        </div>

        {replyOpen ? (
          <div className="mt-3 flex gap-2.5">
            <Avatar
              login={meQuery.data?.login ?? "ghost"}
              avatarUrl={meQuery.data?.avatar_url}
              size="sm"
              className="mt-1 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <textarea
                ref={textareaRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Reply…"
                rows={2}
                disabled={replyMutation.isPending}
                autoFocus
                className="diff-comment-input w-full resize-none rounded-lg p-2.5 text-ui text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-[var(--diff-comment-border)]/40"
              />
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-caption text-muted-foreground/40">⌘↵</span>
                <div className="flex gap-1.5">
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => { setReplyOpen(false); setBody(""); }}
                    disabled={replyMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="xs"
                    disabled={!body.trim() || replyMutation.isPending}
                    onClick={handleReply}
                  >
                    <Send data-icon="inline-start" />
                    {replyMutation.isPending ? "Sending…" : "Reply"}
                  </Button>
                </div>
              </div>
            </div>
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

function CommentBubble({
  comment,
  owner,
  repo,
  meId,
  onToggleReaction,
}: {
  comment: ReviewComment;
  owner: string;
  repo: string;
  meId: number | undefined;
  onToggleReaction: (content: ReactionContent, existingId?: number) => void;
}) {
  const myReactionsQuery = useMyReviewCommentReactions(owner, repo, comment.id, meId);
  const myReactions = myReactionsQuery.data ?? EMPTY_MY_REACTIONS;
  const hasReactions = reactionsHaveAny(comment.reactions);

  return (
    <div className="flex gap-2.5">
      <Avatar
        login={comment.user?.login ?? "ghost"}
        avatarUrl={comment.user?.avatar_url}
        size="sm"
        className="mt-0.5 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="text-caption font-medium text-foreground">{comment.user?.login ?? "ghost"}</span>
          <span className="text-caption text-muted-foreground/60">{formatRelativeTime(comment.created_at)}</span>
        </div>
        <div className="mt-1 text-body text-foreground [overflow-wrap:anywhere]">
          <div className="readme-prose max-w-none">
            <GithubMarkdown>{comment.body}</GithubMarkdown>
          </div>
        </div>
        {hasReactions && (
          <ReactionsBar
            reactions={comment.reactions}
            myReactions={myReactions}
            onToggle={onToggleReaction}
            className="border-t-0 pt-0 mt-1.5"
          />
        )}
      </div>
    </div>
  );
}
