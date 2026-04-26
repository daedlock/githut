import type { ReactNode } from "react";
import { Avatar } from "@/app/components/ui/avatar";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { ReactionsBar } from "@/app/features/issues/components/ReactionsBar";
import { EMPTY_MY_REACTIONS, type MyReactionsMap, type ReactionContent, type ReactionsMap } from "@/app/features/issues/schemas";
import { cn } from "@/app/lib/cn";
import { formatRelativeTime } from "@/app/lib/time";

// Re-export the self-contained compose card
export { CommentComposeCard } from "@/app/components/ui/CommentComposeCard";

/**
 * Unified comment component for:
 * - Displaying comments (issues, PRs, reviews)
 * - Composing new comments
 * - Inline replies
 */

export type CommentCardProps = {
  login: string;
  avatarUrl?: string;
  date?: string;
  isAuthor?: boolean;
  actions?: ReactNode;
  className?: string;
  inline?: boolean;
  reactions?: ReactionsMap;
  myReactions?: MyReactionsMap;
  onToggleReaction?: (content: ReactionContent, existingReactionId?: number) => void;
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
  reactions,
  myReactions,
  onToggleReaction,
}: CommentCardProps & { children: ReactNode }) {
  const showReactions = !!reactions;

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
          {showReactions && (
            <ReactionsBar reactions={reactions} myReactions={myReactions ?? EMPTY_MY_REACTIONS} onToggle={onToggleReaction} />
          )}
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
      <div className="p-4">
        {children}
        {showReactions && (
          <ReactionsBar reactions={reactions} myReactions={myReactions ?? EMPTY_MY_REACTIONS} onToggle={onToggleReaction} />
        )}
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
