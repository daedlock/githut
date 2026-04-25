import { CheckCircle2, CircleDot, Tag, User, X } from "lucide-react";
import { GithubMarkdown } from "@/app/components/GithubMarkdown";
import { StatusMessage } from "@/app/components/StatusMessage";
import { Avatar } from "@/app/components/ui/avatar";
import { Button } from "@/app/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader } from "@/app/components/ui/CardBlock";
import { CommentBox } from "@/app/components/ui/CommentBox";
import { Container } from "@/app/components/ui/Container";
import { ProfileLink } from "@/app/components/user/ProfileLink";
import { AssigneeList } from "@/app/features/issues/components/AssigneeList";
import { IssueCommentCard } from "@/app/features/issues/components/CommentCard";
import { IssueStatePill } from "@/app/features/issues/components/IssueStatePill";
import { LabelPill } from "@/app/features/issues/components/LabelPill";
import { SidebarSection } from "@/app/features/issues/components/SidebarSection";
import { useMyCommentReactions, useMyIssueReactions } from "@/app/features/issues/hooks";
import {
  EMPTY_MY_REACTIONS,
  type ReactionContent,
  type RepoIssue,
  type RepoIssueComment,
} from "@/app/features/issues/schemas";
import { cn } from "@/app/lib/cn";
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
  onSubmitComment: (e: React.FormEvent<HTMLFormElement>) => void;
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

  return (
    <Container className="py-5 sm:py-6">
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
            disabled={isTogglingState}
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
        <StatusMessage>Loading issue…</StatusMessage>
      ) : isError ? (
        <StatusMessage tone="danger">Could not load this issue.</StatusMessage>
      ) : !issue ? (
        <StatusMessage tone="danger">This issue no longer exists.</StatusMessage>
      ) : (
        <>
          <div className="mb-5">
            <h1 className="text-xl font-semibold leading-snug tracking-tight text-foreground sm:text-2xl">
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

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
            {/* Main column */}
            <div className="min-w-0 flex-1 flex flex-col gap-3">
              <IssueCommentCard
                login={issue.user.login}
                avatarUrl={issue.user.avatar_url}
                date={issue.created_at}
                isAuthor
                reactions={issue.reactions}
                myReactions={myIssueReactions ?? EMPTY_MY_REACTIONS}
                onToggleReaction={onToggleIssueReaction}
              >
                {issue.body?.trim() ? (
                  <div className="readme-prose max-w-none text-body">
                    <GithubMarkdown>{issue.body}</GithubMarkdown>
                  </div>
                ) : (
                  <p className="text-body italic text-[var(--color-fg-faint)]">
                    No description provided.
                  </p>
                )}
              </IssueCommentCard>

              {commentsLoading ? (
                <StatusMessage>Loading comments…</StatusMessage>
              ) : commentsError ? (
                <StatusMessage tone="danger">Could not load comments.</StatusMessage>
              ) : (
                comments.map((c) => (
                  <CommentCardWithReactions
                    key={c.id}
                    owner={owner}
                    repo={repo}
                    meId={me?.id}
                    comment={c}
                    onToggleReaction={onToggleCommentReaction}
                  />
                ))
              )}

              <Card as="div" radius="md" tone="default" border="strong">
                <form onSubmit={onSubmitComment}>
                  <CardHeader>
                    {me?.avatar_url && (
                      <Avatar login={me.login} avatarUrl={me.avatar_url} size="sm" />
                    )}
                    <span className="text-body font-medium text-foreground">Add a comment</span>
                  </CardHeader>
                  <CardBody flush>
                    <CommentBox
                      owner={owner}
                      repo={repo}
                      value={newCommentBody}
                      onChange={onNewCommentChange}
                      placeholder="Leave a comment"
                      rows={4}
                    />
                  </CardBody>
                  <CardFooter className="flex justify-end">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={!newCommentBody.trim() || isPostingComment}
                    >
                      {isPostingComment ? "Posting…" : "Comment"}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </div>

            {/* Sidebar */}
            <aside className="w-full lg:w-52 lg:flex-shrink-0">
              <div className="flex flex-col gap-5">
                <SidebarSection icon={<Tag className="size-3.5" />} title="Labels">
                  {issue.labels.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {issue.labels.map((label) => (
                        <LabelPill key={label.id} label={label} size="sm" />
                      ))}
                    </div>
                  ) : (
                    <span className="text-caption text-[var(--color-fg-faint)]">None yet</span>
                  )}
                </SidebarSection>

                <SidebarSection icon={<User className="size-3.5" />} title="Assignees">
                  <AssigneeList assignees={issue.assignees} variant="rows" />
                </SidebarSection>
              </div>
            </aside>
          </div>
        </>
      )}
    </Container>
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
  comment,
  onToggleReaction,
}: {
  owner: string;
  repo: string;
  meId: number | undefined;
  comment: RepoIssueComment;
  onToggleReaction: (
    commentId: number,
    content: ReactionContent,
    existingReactionId?: number,
  ) => void;
}) {
  const { data: myReactions } = useMyCommentReactions(owner, repo, comment.id, meId);
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
    >
      <div className="readme-prose max-w-none text-body">
        <GithubMarkdown>{comment.body}</GithubMarkdown>
      </div>
    </IssueCommentCard>
  );
}
