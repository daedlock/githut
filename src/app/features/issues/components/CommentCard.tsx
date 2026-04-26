import type { ReactNode } from "react";
import { CommentCardDisplay } from "@/app/components/ui/CommentCard";
import { ReactionsBar } from "@/app/features/issues/components/ReactionsBar";
import type { MyReactionsMap, ReactionContent, ReactionsMap } from "@/app/features/issues/schemas";
import type { MentionUser } from "@/app/hooks/useMentionSearch";

/**
 * IssueCommentCard — Issue comment with reactions using unified Comment component.
 */
export function IssueCommentCard({
  login,
  avatarUrl,
  date,
  isAuthor,
  reactions,
  myReactions,
  onToggleReaction,
  children,
  // Edit/delete passthrough
  canEdit,
  rawBody,
  onSave,
  onDelete,
  participants,
  repoOwner,
  repoName,
  isSaving,
}: {
  login: string;
  avatarUrl?: string;
  date: string;
  isAuthor?: boolean;
  reactions: ReactionsMap;
  myReactions: MyReactionsMap;
  onToggleReaction: (content: ReactionContent, existingReactionId?: number) => void;
  children: ReactNode;
  canEdit?: boolean;
  rawBody?: string;
  onSave?: (next: string) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
  participants?: MentionUser[];
  repoOwner?: string;
  repoName?: string;
  isSaving?: boolean;
}) {
  return (
    <CommentCardDisplay
      login={login}
      avatarUrl={avatarUrl}
      date={date}
      isAuthor={isAuthor}
      canEdit={canEdit}
      rawBody={rawBody}
      onSave={onSave}
      onDelete={onDelete}
      participants={participants}
      repoOwner={repoOwner}
      repoName={repoName}
      isSaving={isSaving}
    >
      {children}
      <ReactionsBar reactions={reactions} myReactions={myReactions} onToggle={onToggleReaction} />
    </CommentCardDisplay>
  );
}
