import type { ReactNode } from "react";
import { Avatar } from "@/app/components/ui/avatar";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { cn } from "@/app/lib/cn";
import { formatRelativeTime } from "@/app/lib/time";

/**
 * Unified comment component for:
 * - Issue comments
 * - PR conversation comments
 * - Review comments
 * - Reply threads
 *
 * Variants:
 * - card: Full card with header strip (default for main comments)
 * - inline: Compact row layout (for threaded replies)
 * - composer: Editable state for new comments
 */

export type CommentProps = {
  /** Author login */
  login: string;
  /** Author avatar URL */
  avatarUrl?: string;
  /** Comment timestamp */
  date?: string;
  /** Show "Author" badge */
  isAuthor?: boolean;
  /** Right-side header actions (e.g., reaction button, edit menu) */
  actions?: ReactNode;
  /** Comment body */
  children: ReactNode;
  /** Additional class names */
  className?: string;
};

/**
 * Comment — Card variant with header strip.
 * Use for main comments in issues and PRs.
 */
export function Comment({
  login,
  avatarUrl,
  date,
  isAuthor,
  actions,
  children,
  className,
}: CommentProps) {
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
 * CommentInline — Compact row layout for threaded replies.
 */
export function CommentInline({
  login,
  avatarUrl,
  date,
  isAuthor,
  actions,
  children,
  className,
}: CommentProps) {
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

/**
 * CommentThread — Container for a thread of inline comments.
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

/**
 * CommentComposer — Simple composer for inline replies.
 * For full-featured editing, use CommentBox directly.
 */
export function CommentComposer({
  login,
  avatarUrl,
  placeholder = "Reply…",
  submitLabel = "Reply",
  cancelLabel = "Cancel",
  showCancel = true,
  onSubmit,
  onCancel,
  isPending,
  className,
}: CommentProps & {
  placeholder?: string;
  submitLabel?: string;
  cancelLabel?: string;
  showCancel?: boolean;
  onSubmit: (body: string) => void;
  onCancel?: () => void;
  isPending?: boolean;
}) {
  return (
    <div className={cn("flex gap-2.5", className)}>
      <Avatar login={login} avatarUrl={avatarUrl} size="sm" className="flex-shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <textarea
          placeholder={placeholder}
          rows={2}
          className={cn(
            "w-full resize-none rounded-lg border border-input bg-background p-2.5",
            "text-sm text-foreground placeholder:text-muted-foreground",
            "focus:outline-none focus:ring-2 focus:ring-ring/40",
          )}
          disabled={isPending}
        />
        <div className="mt-2 flex justify-end gap-2">
          {showCancel && (
            <Button size="sm" variant="ghost" onClick={onCancel} disabled={isPending}>
              {cancelLabel}
            </Button>
          )}
          <Button size="sm" disabled={isPending}>
            {isPending ? "Submitting…" : submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
