import type { ReactNode } from "react";
import { Avatar } from "@/app/components/ui/avatar";
import { Card } from "@/app/components/ui/card";
import { ProfileLink } from "@/app/components/user/ProfileLink";
import { cn } from "@/app/lib/cn";
import { formatRelativeTime } from "@/app/lib/time";

export type CommentProps = {
  /** Author login */
  login: string;
  /** Author avatar URL */
  avatarUrl?: string;
  /** Comment date (ISO string) */
  date: string;
  /** Show "Author" badge */
  isAuthor?: boolean;
  /** Optional header right side content (e.g., review state badge) */
  headerRight?: ReactNode;
  /** Comment body */
  children: ReactNode;
  /** Additional className */
  className?: string;
};

/**
 * Comment — unified comment display component.
 *
 * Used for:
 * - Issue comments (body + replies)
 * - PR conversation comments
 * - Review comments
 * - Timeline comments
 *
 * Features:
 * - Avatar + login + relative time
 * - Optional "Author" badge
 * - Optional header right slot (review state, etc.)
 * - Surface background with subtle header strip
 */
export function Comment({
  login,
  avatarUrl,
  date,
  isAuthor,
  headerRight,
  children,
  className,
}: CommentProps) {
  return (
    <Card variant="muted" className={cn("overflow-hidden", className)}>
      {/* Header strip */}
      <div className="flex items-center gap-2 bg-muted/50 px-4 py-2">
        <Avatar login={login} avatarUrl={avatarUrl} size="sm" />
        <ProfileLink login={login} className="text-xs font-medium text-foreground">
          {login}
        </ProfileLink>
        {isAuthor && (
          <span className="rounded bg-background px-1.5 py-0.5 text-xs text-muted-foreground">
            Author
          </span>
        )}
        <span className="text-xs text-muted-foreground">commented</span>
        <span className="text-xs text-muted-foreground/60">{formatRelativeTime(date)}</span>
        {headerRight && <div className="ml-auto">{headerRight}</div>}
      </div>
      {/* Body */}
      <div className="p-4">{children}</div>
    </Card>
  );
}

export type CommentComposeProps = {
  /** Author login */
  login: string;
  /** Author avatar URL */
  avatarUrl?: string;
  /** Title text (default: "Add a comment") */
  title?: string;
  /** Comment body content (the composer) */
  children: ReactNode;
  /** Additional className */
  className?: string;
};

/**
 * CommentCompose — wrapper for comment composer UI.
 *
 * Shows avatar + title in header, children as body.
 * Use with CommentBox inside.
 */
export function CommentCompose({
  login,
  avatarUrl,
  title = "Add a comment",
  children,
  className,
}: CommentComposeProps) {
  return (
    <Card variant="muted" className={cn("overflow-hidden", className)}>
      {/* Header strip */}
      <div className="flex items-center gap-2 bg-muted/50 px-4 py-2">
        <Avatar login={login} avatarUrl={avatarUrl} size="sm" />
        <span className="text-xs font-medium text-foreground">{title}</span>
      </div>
      {/* Body */}
      <div className="p-4">{children}</div>
    </Card>
  );
}
