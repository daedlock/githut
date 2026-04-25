import type { ReactNode } from "react";
import { Comment } from "@/app/components/ui/CommentCard";
import { ReactionsBar } from "@/app/features/issues/components/ReactionsBar";
import type { MyReactionsMap, ReactionContent, ReactionsMap } from "@/app/features/issues/schemas";

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
}: {
  login: string;
  avatarUrl?: string;
  date: string;
  isAuthor?: boolean;
  reactions: ReactionsMap;
  myReactions: MyReactionsMap;
  onToggleReaction: (content: ReactionContent, existingReactionId?: number) => void;
  children: ReactNode;
}) {
  return (
    <Comment
      login={login}
      avatarUrl={avatarUrl}
      date={date}
      isAuthor={isAuthor}
    >
      {children}
      <ReactionsBar reactions={reactions} myReactions={myReactions} onToggle={onToggleReaction} />
    </Comment>
  );
}
