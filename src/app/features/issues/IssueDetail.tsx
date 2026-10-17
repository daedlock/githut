import { CheckCircle2, CircleDot, X } from "lucide-react";
import { useMemo } from "react";
import { GithubMarkdown } from "@/app/components/GithubMarkdown";
import { LiveUpdates } from "@/app/components/LiveUpdates";
import { StatusMessage } from "@/app/components/StatusMessage";
import { Avatar } from "@/app/components/ui/avatar";
import { Button } from "@/app/components/ui/button";
import { CommentSkeleton } from "@/app/components/ui/CommentSkeleton";
import { ComposeBox } from "@/app/components/ui/ComposeBox";
import { Container } from "@/app/components/ui/Container";
import { MetadataSkeleton } from "@/app/components/ui/MetadataSkeleton";
import { Skeleton, SkeletonGroup } from "@/app/components/ui/skeleton";
import { ProfileLink } from "@/app/components/user/ProfileLink";
import { IssueCommentCard } from "@/app/features/issues/components/CommentCard";
import { IssueSidebar } from "@/app/features/issues/components/IssueSidebar";
import { IssueStatePill } from "@/app/features/issues/components/IssueStatePill";
import {
  useDeleteIssueComment,
  useMyCommentReactions,
  useMyIssueReactions,
  useUpdateIssue,
  useUpdateIssueComment,
} from "@/app/features/issues/hooks";
import {
  EMPTY_MY_REACTIONS,
  type ReactionContent,
  type RepoIssue,
  type RepoIssueComment,
} from "@/app/features/issues/schemas";
import type { MentionUser } from "@/app/hooks/useMentionSearch";
import { cn } from "@/app/lib/cn";
import { useCanMutate } from "@/app/lib/connectivity";
import { formatRelativeTime } from "@/app/lib/time";

export type IssueDetailProps = {
  owner: string;
  repo: string;
  issue: RepoIssue | undefined;
  isLoading: boolean;
  isError: boolean;
  comments: RepoIssueComment[];
  commentsLoading: boolean;
  commentsError: boolean;
  newCommentBody: string;
  onNewCommentChange: (s: string) => void;
  onSubmitComment: () => void;
  onToggleState: () => void;
  isTogglingState: boolean;
  isPostingComment: boolean;
  onToggleIssueReaction: (content: ReactionContent, existingReactionId?: number) => void;
  onToggleCommentReaction: (
    commentId: number,
    content: ReactionContent,
    existingReactionId?: number,
  ) => void;
  me: { id: number; login: string; avatar_url: string } | undefined;
  onBack: () => void;
};

export function IssueDetail({
  owner,
  repo,
  issue,
  isLoading,
  isError,
  comments,
  commentsLoading,
  commentsError,
  newCommentBody,
  onNewCommentChange,
  onSubmitComment,
  onToggleState,
  isTogglingState,
  isPostingComment,
  onToggleIssueReaction,
  onToggleCommentReaction,
  me,
  onBack,
}: IssueDetailProps) {
  // My reactions for the issue body itself. Per-comment fetches live inside
  // CommentCardWithReactions so each comment has an independently-keyed cache.
  const { data: myIssueReactions } = useMyIssueReactions(owner, repo, issue?.number, me?.id);
  const updateIssueMutation = useUpdateIssue(owner, repo);
  const { canMutate, reason: cannotMutateReason } = useCanMutate();

  const isMyIssue = !!me && !!issue && me.login === issue.user.login;

  const participants = useMemo((): MentionUser[] => {
    const seen = new Set<string>();
    const users: MentionUser[] = [];
    const add = (u: { login: string; avatar_url: string }) => {
      if (seen.has(u.login)) return;
      seen.add(u.login);
      users.push({ kind: "@", id: u.login, login: u.login, avatar: u.avatar_url });
    };
    if (issue?.user) add(issue.user);
    for (const c of comments) add(c.user);
    return users;
  }, [issue, comments]);

  return (
    <Container className="py-5 @xl/pane:py-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-sm px-1 py-0.5 -ml-1",
            "text-body text-muted-foreground outline-none transition-colors",
            "hover:text-foreground focus-visible:ring-1 focus-visible:ring-foreground/15",
          )}
        >
          <X className="size-3.5" />
          Back to issues
        </button>
        {issue && (
          <Button
            variant={issue.state === "open" ? "secondary" : "default"}
            size="sm"
            disabled={isTogglingState || !canMutate}
            title={cannotMutateReason}
            onClick={onToggleState}
          >
            {issue.state === "open" ? (
              <>
                <CheckCircle2 data-icon="inline-start" />
                Close issue
              </>
            ) : (
              <>
                <CircleDot data-icon="inline-start" />
                Reopen issue
              </>
            )}
          </Button>
        )}
      </div>

      {isLoading ? (
        <IssueDetailSkeleton />
      ) : isError ? (
        <StatusMessage tone="danger">Could not load this issue.</StatusMessage>
      ) : !issue ? (
        <StatusMessage tone="danger">This issue no longer exists.</StatusMessage>
      ) : (
        <>
          <div className="mb-5">
            <h1 className="text-xl font-semibold leading-snug tracking-tight text-foreground @xl/pane:text-2xl">
              {issue.title}{" "}
              <span className="font-mono text-title font-normal text-[var(--color-fg-faint)]">
                #{issue.number}
              </span>
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-body text-muted-foreground">
              <IssueStatePill state={issue.state} />
              <span>
                <ProfileLink login={issue.user.login} className="font-medium text-foreground">
                  {issue.user.login}
                </ProfileLink>
                {" opened this issue "}
                {formatRelativeTime(issue.created_at)}
              </span>
              <span className="text-[var(--color-fg-faint)]">·</span>
              <span>
                {issue.comments} {issue.comments === 1 ? "comment" : "comments"}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-4 @4xl/pane:flex-row @4xl/pane:gap-6">
            {/* Main column */}
            <LiveUpdates
              key={`${owner}/${repo}/${issue.number}`}
              ready={!commentsLoading}
              className="min-w-0 flex-1 flex flex-col gap-3"
            >
              <div data-live-anchor>
                <IssueCommentCard
                  login={issue.user.login}
                  avatarUrl={issue.user.avatar_url}
                  date={issue.created_at}
                  isAuthor
                  reactions={issue.reactions}
                  myReactions={myIssueReactions ?? EMPTY_MY_REACTIONS}
                  onToggleReaction={onToggleIssueReaction}
                  canEdit={isMyIssue}
                  rawBody={issue.body ?? ""}
                  onSave={async (next) => {
                    await updateIssueMutation.mutateAsync({
                      issueNumber: issue.number,
                      body: next,
                    });
                  }}
                  participants={participants}
                  repoOwner={owner}
                  repoName={repo}
                  isSaving={updateIssueMutation.isPending}
                >
                  {issue.body?.trim() ? (
                    <div className="readme-prose max-w-none text-body">
                      <GithubMarkdown repoContext={{ owner, repo }}>{issue.body}</GithubMarkdown>
                    </div>
                  ) : (
                    <p className="text-body italic text-[var(--color-fg-faint)]">
                      No description provided.
                    </p>
                  )}
                </IssueCommentCard>
              </div>

              {commentsLoading ? (
                <CommentSkeleton label="Loading comments" />
              ) : commentsError ? (
                <StatusMessage tone="danger">Could not load comments.</StatusMessage>
              ) : (
                comments.map((c) => (
                  <div key={c.id} data-live-item={`c-${c.id}`} tabIndex={-1}>
                    <CommentCardWithReactions
                      owner={owner}
                      repo={repo}
                      meId={me?.id}
                      meLogin={me?.login}
                      issueNumber={issue.number}
                      comment={c}
                      onToggleReaction={onToggleCommentReaction}
                      participants={participants}
                    />
                  </div>
                ))
              )}

              <div data-live-anchor className="flex gap-3">
                {me?.avatar_url && (
                  <Avatar
                    login={me.login}
                    avatarUrl={me.avatar_url}
                    size="sm"
                    className="mt-2 shrink-0"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <ComposeBox
                    owner={owner}
                    repo={repo}
                    value={newCommentBody}
                    onChange={onNewCommentChange}
                    onSubmit={onSubmitComment}
                    submitLabel="Comment"
                    submitDisabled={!newCommentBody.trim()}
                    submitPending={isPostingComment}
                    placeholder="Leave a comment"
                    rows={4}
                    participants={participants}
                  />
                </div>
              </div>
            </LiveUpdates>

            {/* Sidebar */}
            <aside className="w-full self-stretch @4xl/pane:w-[328px] @4xl/pane:shrink-0">
              <div className="@4xl/pane:sticky @4xl/pane:top-[calc(var(--app-header-height)+16px)]">
                <IssueSidebar owner={owner} repo={repo} issue={issue} />
              </div>
            </aside>
          </div>
        </>
      )}
    </Container>
  );
}

function IssueDetailSkeleton() {
  return (
    <div>
      <SkeletonGroup label="Loading issue" className="mb-5 space-y-3">
        <Skeleton className="h-7 w-3/4" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-16 shrink-0 rounded-full" />
          <Skeleton className="h-4 w-64" />
        </div>
      </SkeletonGroup>
      <div className="flex flex-col gap-4 @4xl/pane:flex-row @4xl/pane:gap-6">
        <div className="min-w-0 flex-1 space-y-3">
          <CommentSkeleton label="Loading issue description" />
          <CommentSkeleton label="Loading comments" />
        </div>
        <div className="w-full @4xl/pane:w-[328px] @4xl/pane:shrink-0">
          <MetadataSkeleton />
        </div>
      </div>
    </div>
  );
}

/**
 * Per-comment wrapper that owns its own my-reactions fetch. Each card has an
 * independently-keyed React Query entry so toggles don't thrash neighbors and
 * optimistic temp comments (negative ids) skip the network until promoted.
 */
function CommentCardWithReactions({
  owner,
  repo,
  meId,
  meLogin,
  issueNumber,
  comment,
  onToggleReaction,
  participants,
}: {
  owner: string;
  repo: string;
  meId: number | undefined;
  meLogin: string | undefined;
  issueNumber: number;
  comment: RepoIssueComment;
  onToggleReaction: (
    commentId: number,
    content: ReactionContent,
    existingReactionId?: number,
  ) => void;
  participants?: MentionUser[];
}) {
  const { data: myReactions } = useMyCommentReactions(owner, repo, comment.id, meId);
  const updateComment = useUpdateIssueComment(owner, repo, issueNumber);
  const deleteComment = useDeleteIssueComment(owner, repo, issueNumber);
  const isMine = !!meLogin && meLogin === comment.user.login;

  return (
    <IssueCommentCard
      login={comment.user.login}
      avatarUrl={comment.user.avatar_url}
      date={comment.created_at}
      reactions={comment.reactions}
      myReactions={myReactions ?? EMPTY_MY_REACTIONS}
      onToggleReaction={(content, existingReactionId) =>
        onToggleReaction(comment.id, content, existingReactionId)
      }
      canEdit={isMine}
      rawBody={comment.body}
      onSave={async (next) => {
        await updateComment.mutateAsync({ commentId: comment.id, body: next });
      }}
      onDelete={async () => {
        await deleteComment.mutateAsync({ commentId: comment.id });
      }}
      participants={participants}
      repoOwner={owner}
      repoName={repo}
      isSaving={updateComment.isPending || deleteComment.isPending}
    >
      <div className="readme-prose max-w-none text-body">
        <GithubMarkdown repoContext={{ owner, repo }}>{comment.body}</GithubMarkdown>
      </div>
    </IssueCommentCard>
  );
}
