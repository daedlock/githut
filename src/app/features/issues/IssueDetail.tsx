import { CheckCircle2, CircleDot, Loader2 } from "lucide-react";
import { useMemo, useRef } from "react";
import { BackLink } from "@/app/components/BackLink";
import { EmptyState } from "@/app/components/EmptyState";
import { GithubMarkdown } from "@/app/components/GithubMarkdown";
import { Avatar } from "@/app/components/ui/avatar";
import { Button } from "@/app/components/ui/button";
import { CommentSkeleton } from "@/app/components/ui/CommentSkeleton";
import { ComposeBox } from "@/app/components/ui/ComposeBox";
import { Container } from "@/app/components/ui/Container";
import { Kbd } from "@/app/components/ui/kbd";
import { MetadataSkeleton } from "@/app/components/ui/MetadataSkeleton";
import { Skeleton, SkeletonGroup } from "@/app/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
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
import { useKeybindings } from "@/app/hooks/useKeybindings";
import type { MentionUser } from "@/app/hooks/useMentionSearch";
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
}: IssueDetailProps) {
  // My reactions for the issue body itself. Per-comment fetches live inside
  // CommentCardWithReactions so each comment has an independently-keyed cache.
  const { data: myIssueReactions } = useMyIssueReactions(owner, repo, issue?.number, me?.id);
  const updateIssueMutation = useUpdateIssue(owner, repo);

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

  const isOpen = issue?.state === "open";
  const toggleState = () => {
    if (issue && !isTogglingState) onToggleState();
  };
  const toggleStateRef = useRef(toggleState);
  toggleStateRef.current = toggleState;
  useKeybindings(useMemo(() => ({ "shift+c": () => toggleStateRef.current() }), []));

  return (
    <Container className="py-6">
      <BackLink to={`/${owner}/${repo}/issues`} className="mb-3">
        Issues
      </BackLink>

      {isLoading ? (
        <IssueDetailSkeleton />
      ) : isError ? (
        <EmptyState tone="error">Could not load this issue.</EmptyState>
      ) : !issue ? (
        <EmptyState tone="error">This issue no longer exists.</EmptyState>
      ) : (
        <>
          <header className="mb-6">
            <div className="flex items-start gap-3">
              <h1 className="min-w-0 flex-1 text-heading font-[475] text-foreground [overflow-wrap:anywhere]">
                {issue.title}
              </h1>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={isOpen ? "secondary" : "default"}
                    size="sm"
                    className="mt-px"
                    aria-busy={isTogglingState || undefined}
                    aria-keyshortcuts="Shift+C"
                    onClick={toggleState}
                  >
                    {isTogglingState ? (
                      <Loader2 data-icon="inline-start" className="motion-safe:animate-spin" />
                    ) : isOpen ? (
                      <CheckCircle2 data-icon="inline-start" />
                    ) : (
                      <CircleDot data-icon="inline-start" />
                    )}
                    {isOpen ? "Close issue" : "Reopen issue"}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isOpen ? "Close issue" : "Reopen issue"} <Kbd>⇧C</Kbd>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-caption text-muted-foreground">
              <IssueStatePill state={issue.state} stateReason={issue.state_reason} />
              <span aria-hidden className="opacity-50">
                ·
              </span>
              <span className="font-mono">#{issue.number}</span>
              <span aria-hidden className="opacity-50">
                ·
              </span>
              <ProfileLink login={issue.user.login} className="font-medium text-foreground">
                {issue.user.login}
              </ProfileLink>
              <span>opened {formatRelativeTime(issue.created_at)}</span>
              <span aria-hidden className="opacity-50">
                ·
              </span>
              <span className="tabular-nums">
                {issue.comments} {issue.comments === 1 ? "comment" : "comments"}
              </span>
            </div>
          </header>

          <div className="flex flex-col gap-6 lg:flex-row">
            {/* Main column */}
            <div className="flex min-w-0 flex-1 flex-col gap-3">
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
                  await updateIssueMutation.mutateAsync({ issueNumber: issue.number, body: next });
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
                  <p className="text-body text-muted-foreground">No description provided.</p>
                )}
              </IssueCommentCard>

              {commentsLoading ? (
                <CommentSkeleton label="Loading comments" />
              ) : commentsError ? (
                <EmptyState tone="error" className="py-8">
                  Could not load comments.
                </EmptyState>
              ) : (
                comments.map((c) => (
                  <CommentCardWithReactions
                    key={c.id}
                    owner={owner}
                    repo={repo}
                    meId={me?.id}
                    meLogin={me?.login}
                    issueNumber={issue.number}
                    comment={c}
                    onToggleReaction={onToggleCommentReaction}
                    participants={participants}
                  />
                ))
              )}

              <div className="flex gap-3">
                {me?.avatar_url && (
                  <Avatar
                    login={me.login}
                    avatarUrl={me.avatar_url}
                    size="sm"
                    className="mt-2.5 shrink-0"
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
            </div>

            {/* Sidebar */}
            <aside className="w-full self-stretch lg:w-72 lg:shrink-0">
              <div className="sticky top-[calc(var(--app-header-height)+--spacing(6))]">
                <IssueSidebar owner={owner} repo={repo} issue={issue} />
              </div>
            </aside>
          </div>
        </>
      )}
    </Container>
  );
}

/** Mirrors the loaded header, comment column and sidebar geometry. */
function IssueDetailSkeleton() {
  return (
    <div>
      <SkeletonGroup label="Loading issue" className="mb-6">
        <div className="flex h-7.5 items-center">
          <Skeleton className="h-5 w-3/4" />
        </div>
        <div className="mt-2 flex h-5 items-center gap-1.5">
          <Skeleton className="h-5 w-14 shrink-0 rounded-full" />
          <Skeleton className="h-3 w-64" />
        </div>
      </SkeletonGroup>
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <CommentSkeleton label="Loading issue description" />
          <CommentSkeleton label="Loading comments" />
        </div>
        <div className="w-full lg:w-72 lg:shrink-0">
          <MetadataSkeleton sections={2} />
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
