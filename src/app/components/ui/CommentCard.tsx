import type { ReactNode } from "react";
import { useState } from "react";
import { Avatar } from "@/app/components/ui/avatar";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { CommentBox } from "@/app/components/ui/CommentBox";
import { cn } from "@/app/lib/cn";
import { formatRelativeTime } from "@/app/lib/time";

/**
 * Unified comment component for:
 * - Displaying comments (issues, PRs, reviews)
 * - Composing new comments
 * - Inline replies
 *
 * Modes:
 * - display: Show rendered comment
 * - compose: Show editor for new comment
 * - reply: Compact inline editor
 */

export type CommentCardProps = {
  /** Author login */
  login: string;
  /** Author avatar URL */
  avatarUrl?: string;
  /** Comment timestamp (display mode only) */
  date?: string;
  /** Show "Author" badge */
  isAuthor?: boolean;
  /** Right-side header actions */
  actions?: ReactNode;
  /** Additional class names */
  className?: string;
  /** Inline variant (no card wrapper) */
  inline?: boolean;
};

/**
 * CommentCard.Display — Show a comment.
 */
export function CommentCardDisplay({
  login,
  avatarUrl,
  date,
  isAuthor,
  actions,
  children,
  className,
  inline = false,
}: CommentCardProps & { children: ReactNode }) {
  if (inline) {
    return (
      <div className={cn("flex gap-2.5", className)}>
        <Avatar login={login} avatarUrl={avatarUrl} size="sm" className="flex-shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span className="text-xs font-medium text-foreground">{login}</span>
            {isAuthor && (
              <span className="rounded bg-muted px-1 py-0.5 text-[10px] font-medium text-muted-foreground">
                Author
              </span>
            )}
            {date && (
              <span className="text-xs text-muted-foreground/60">{formatRelativeTime(date)}</span>
            )}
            {actions}
          </div>
          <div className="mt-1 text-sm">{children}</div>
        </div>
      </div>
    );
  }

  return (
    <Card variant="muted" className={cn("overflow-hidden", className)}>
      <div className="flex items-center gap-2 border-b border-border/50 bg-muted/50 px-4 py-2">
        <Avatar login={login} avatarUrl={avatarUrl} size="sm" />
        <span className="text-xs font-medium text-foreground">{login}</span>
        {isAuthor && (
          <span className="rounded bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            Author
          </span>
        )}
        {date && (
          <>
            <span className="text-xs text-muted-foreground">commented</span>
            <span className="text-xs text-muted-foreground/60">{formatRelativeTime(date)}</span>
          </>
        )}
        {actions && <div className="ml-auto">{actions}</div>}
      </div>
      <div className="p-4">{children}</div>
    </Card>
  );
}

/**
 * CommentCard.Compose — Editor for new comments.
 * Uses CommentBox for @mentions and #references support.
 */
export function CommentCardCompose({
  login,
  avatarUrl,
  owner,
  repo,
  placeholder = "Leave a comment",
  submitLabel = "Comment",
  cancelLabel = "Cancel",
  showCancel = false,
  rows = 4,
  value,
  onChange,
  onSubmit,
  onCancel,
  isPending,
  className,
}: CommentCardProps & {
  owner: string;
  repo: string;
  placeholder?: string;
  submitLabel?: string;
  cancelLabel?: string;
  showCancel?: boolean;
  rows?: number;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  isPending?: boolean;
}) {
  return (
    <Card variant="muted" className={cn("overflow-hidden", className)}>
      <div className="flex items-center gap-2 bg-muted/50 px-4 py-2">
        <Avatar login={login} avatarUrl={avatarUrl} size="sm" />
        <span className="text-xs font-medium text-foreground">{login}</span>
      </div>
      <div className="p-4">
        <CommentBox
          owner={owner}
          repo={repo}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          rows={rows}
        />
        <div className="mt-3 flex justify-end gap-2">
          {showCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel} disabled={isPending}>
              {cancelLabel}
            </Button>
          )}
          <Button size="sm" disabled={!value.trim() || isPending} onClick={onSubmit}>
            {isPending ? "Submitting…" : submitLabel}
          </Button>
        </div>
      </div>
    </Card>
  );
}

/**
 * CommentCard.Reply — Compact inline reply composer.
 */
export function CommentCardReply({
  login,
  avatarUrl,
  placeholder = "Reply…",
  submitLabel = "Reply",
  value,
  onChange,
  onSubmit,
  onCancel,
  isPending,
  className,
}: CommentCardProps & {
  placeholder?: string;
  submitLabel?: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isPending?: boolean;
}) {
  return (
    <div className={cn("flex gap-2.5", className)}>
      <Avatar login={login} avatarUrl={avatarUrl} size="sm" className="flex-shrink-0 mt-1" />
      <div className="min-w-0 flex-1">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className={cn(
            "w-full resize-none rounded-lg border border-input bg-background p-2.5",
            "text-sm text-foreground placeholder:text-muted-foreground",
            "focus:outline-none focus:ring-2 focus:ring-ring/40",
          )}
          disabled={isPending}
          autoFocus
        />
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button size="sm" disabled={!value.trim() || isPending} onClick={onSubmit}>
            {isPending ? "Submitting…" : submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * CommentThread — Container for a thread of comments.
 */
export function CommentThread({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col divide-y divide-border", className)}>
      {children}
    </div>
  );
}
