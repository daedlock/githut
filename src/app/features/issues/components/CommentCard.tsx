import type { ReactNode } from "react";
import { Avatar } from "@/app/components/ui/avatar";
import { Card, CardBody, CardHeader } from "@/app/components/ui/Card";
import { ProfileLink } from "@/app/components/user/ProfileLink";
import { ReactionsBar } from "@/app/features/issues/components/ReactionsBar";
import type { MyReactionsMap, ReactionContent, ReactionsMap } from "@/app/features/issues/schemas";
import { formatRelativeTime } from "@/app/lib/time";

/**
 * CommentCard — a framed comment block used for the issue body and each reply.
 * Accepts children so the consumer decides how the body is rendered (markdown,
 * empty state, future PR review body with file diffs, etc.).
 *
 * Reactions are driven by two maps:
 *   - `reactions` (counts) — from the issue/comment payload
 *   - `myReactions` (content → reactionId) — from a separate /reactions fetch
 *     that lets us highlight pills the viewer reacted to and toggle-off by id.
 */
export function CommentCard({
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
    <Card radius="md" tone="default" border="soft" as="article">
      <CardHeader>
        <Avatar login={login} avatarUrl={avatarUrl} size="sm" />
        <p className="text-body text-muted-foreground">
          <ProfileLink login={login} className="font-medium text-foreground">
            {login}
          </ProfileLink>
          {" commented "}
          {formatRelativeTime(date)}
        </p>
        {isAuthor && (
          <span className="ml-auto rounded-sm border border-border px-1.5 py-px font-mono text-micro uppercase tracking-widest text-[var(--color-fg-faint)]">
            Author
          </span>
        )}
      </CardHeader>
      <CardBody>
        {children}
        <ReactionsBar
          reactions={reactions}
          myReactions={myReactions}
          onToggle={onToggleReaction}
        />
      </CardBody>
    </Card>
  );
}
