import type { ReactNode } from "react";
import { Avatar } from "@/app/components/ui/Avatar";
import { Card, CardBody, CardHeader } from "@/app/components/ui/Card";
import { ReactionsBar } from "@/app/features/issues/components/ReactionsBar";
import type { ReactionContent, ReactionsMap } from "@/app/features/issues/schemas";
import { formatRelativeTime } from "@/app/lib/time";

/**
 * CommentCard — a framed comment block used for the issue body and each reply.
 * Accepts children so the consumer decides how the body is rendered (markdown,
 * empty state, future PR review body with file diffs, etc.).
 */
export function CommentCard({
  login,
  avatarUrl,
  date,
  isAuthor,
  reactions,
  onAddReaction,
  children,
}: {
  login: string;
  avatarUrl?: string;
  date: string;
  isAuthor?: boolean;
  reactions: ReactionsMap;
  onAddReaction: (content: ReactionContent) => void;
  children: ReactNode;
}) {
  return (
    <Card radius="md" tone="default" border="soft" as="article">
      <CardHeader>
        <Avatar login={login} avatarUrl={avatarUrl} size="sm" />
        <p className="text-sm text-[var(--color-fg-muted)]">
          <span className="font-medium text-[var(--color-fg)]">{login}</span>
          {" commented "}
          {formatRelativeTime(date)}
        </p>
        {isAuthor && (
          <span className="ml-auto rounded border border-[var(--color-border)] px-1.5 py-px font-mono text-[10px] uppercase tracking-widest text-[var(--color-fg-faint)]">
            Author
          </span>
        )}
      </CardHeader>
      <CardBody>
        {children}
        <ReactionsBar reactions={reactions} onAdd={onAddReaction} />
      </CardBody>
    </Card>
  );
}
