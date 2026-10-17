import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Avatar } from "@/app/components/ui/avatar";
import { Button } from "@/app/components/ui/button";
import { ComposeBox } from "@/app/components/ui/ComposeBox";
import { Card } from "@/app/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { ReactionsBar } from "@/app/features/issues/components/ReactionsBar";
import {
  EMPTY_MY_REACTIONS,
  type MyReactionsMap,
  type ReactionContent,
  type ReactionsMap,
} from "@/app/features/issues/schemas";
import type { MentionUser } from "@/app/hooks/useMentionSearch";
import { cn } from "@/app/lib/cn";
import { useCanMutate } from "@/app/lib/connectivity";
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
  /** Owner-only inline edit/delete. When `canEdit`+`rawBody`+`onSave` are
   *  provided, a 3-dots menu appears with Edit (and Delete when `onDelete`). */
  canEdit?: boolean;
  rawBody?: string;
  onSave?: (next: string) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
  participants?: MentionUser[];
  repoOwner?: string;
  repoName?: string;
  /** When true, the card is currently being saved (spinner state). */
  isSaving?: boolean;
};

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
  canEdit,
  rawBody,
  onSave,
  onDelete,
  participants,
  repoOwner,
  repoName,
  isSaving,
}: CommentCardProps & { children: ReactNode }) {
  const showReactions = !!reactions;
  const editingAvailable = !!(canEdit && onSave && repoOwner && repoName);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(rawBody ?? "");

  // Keep draft in sync if the parent updates rawBody while we're idle
  // (e.g. cache refetch after another tab edited).
  useEffect(() => {
    if (!editing) setDraft(rawBody ?? "");
  }, [rawBody, editing]);

  function startEdit() {
    setDraft(rawBody ?? "");
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
  }

  function commit() {
    if (!onSave) return;
    const next = draft.trim();
    if (!next || next === (rawBody ?? "").trim()) {
      setEditing(false);
      return;
    }
    // Fire-and-forget: the mutation's onMutate writes the new body to the
    // cache synchronously, so closing the editor immediately reveals the
    // updated content. If the request fails, onError rolls back the cache.
    void onSave(next);
    setEditing(false);
  }

  const menuButton = editingAvailable ? (
    <CommentMenu onEdit={startEdit} onDelete={onDelete} disabled={isSaving} />
  ) : null;

  // ── Inline variant (review threads, compact contexts) ──────────────────
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
            {menuButton && <div className="ml-auto">{menuButton}</div>}
          </div>
          <BodySwap
            editing={editing}
            display={<div className="mt-1 text-sm">{children}</div>}
            editor={
              editingAvailable && (
                <div className="mt-1.5">
                  <ComposeBox
                    owner={repoOwner!}
                    repo={repoName!}
                    value={draft}
                    onChange={setDraft}
                    onSubmit={commit}
                    onCancel={cancelEdit}
                    submitLabel="Save"
                    submitPending={isSaving}
                    submitDisabled={!draft.trim() || draft.trim() === (rawBody ?? "").trim()}
                    rows={4}
                    autoFocus
                    participants={participants}
                  />
                </div>
              )
            }
          />
          {!editing && showReactions && (
            <ReactionsBar
              reactions={reactions}
              myReactions={myReactions ?? EMPTY_MY_REACTIONS}
              onToggle={onToggleReaction}
              className="mt-1.5 border-t-0 pt-0"
            />
          )}
        </div>
      </div>
    );
  }

  // ── Carded variant (default — issues, PR conversation, reviews) ─────────
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
        {(actions || menuButton) && (
          <div className="ml-auto flex items-center gap-1">
            {actions}
            {menuButton}
          </div>
        )}
      </div>
      <BodySwap
        editing={editing}
        display={
          <div className="p-4">
            {children}
            {showReactions && (
              <ReactionsBar
                reactions={reactions}
                myReactions={myReactions ?? EMPTY_MY_REACTIONS}
                onToggle={onToggleReaction}
              />
            )}
          </div>
        }
        editor={
          editingAvailable && (
            <div className="p-3">
              <ComposeBox
                owner={repoOwner!}
                repo={repoName!}
                value={draft}
                onChange={setDraft}
                onSubmit={commit}
                onCancel={cancelEdit}
                submitLabel="Save"
                submitPending={isSaving}
                submitDisabled={!draft.trim() || draft.trim() === (rawBody ?? "").trim()}
                rows={5}
                autoFocus
                participants={participants}
              />
            </div>
          )
        }
      />
    </Card>
  );
}

// ─── Body swap (display ↔ edit) ──────────────────────────────────────────
//
// Instant swap. Animating the height change collides with optimistic cache
// updates (a new comment added to a list, an edited body that changed length)
// and produces a visible layout spring. Plain conditional render.

function BodySwap({
  editing,
  display,
  editor,
}: {
  editing: boolean;
  display: ReactNode;
  editor: ReactNode;
}) {
  return <div className="relative">{editing ? editor : display}</div>;
}

// ─── 3-dot menu ──────────────────────────────────────────────────────────

function CommentMenu({
  onEdit,
  onDelete,
  disabled,
}: {
  onEdit: () => void;
  onDelete?: () => Promise<void> | void;
  disabled?: boolean;
}) {
  const confirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { canMutate, reason } = useCanMutate();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(
    () => () => {
      if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
    },
    [],
  );

  function handleDelete(e: Event) {
    if (!onDelete || !canMutate) return;
    if (!confirmingDelete) {
      e.preventDefault();
      setConfirmingDelete(true);
      confirmTimeoutRef.current = setTimeout(() => setConfirmingDelete(false), 2200);
      return;
    }
    if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
    setConfirmingDelete(false);
    void onDelete();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled || !canMutate}
          title={reason}
          aria-label="Comment actions"
          className={cn(
            "inline-flex size-6 items-center justify-center rounded-md outline-none",
            "text-muted-foreground/50 transition-all duration-150",
            "hover:bg-[var(--color-bg-sunken)] hover:text-foreground",
            "focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:text-foreground",
            "data-[state=open]:bg-[var(--color-bg-sunken)] data-[state=open]:text-foreground",
            "disabled:pointer-events-none disabled:opacity-40",
          )}
        >
          <MoreHorizontal className="size-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={4} className="min-w-[140px]">
        <DropdownMenuItem disabled={!canMutate} onSelect={onEdit}>
          <Pencil className="size-3.5" />
          Edit
        </DropdownMenuItem>
        {onDelete && (
          <DropdownMenuItem
            variant="destructive"
            disabled={!canMutate}
            onSelect={handleDelete}
            onPointerLeave={() => {
              if (!confirmingDelete) return;
              setConfirmingDelete(false);
              if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
            }}
          >
            <Trash2 className="size-3.5" />
            {confirmingDelete ? "Click again to confirm" : "Delete"}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
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
  const { canMutate, reason } = useCanMutate();
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
          <Button
            size="sm"
            disabled={!value.trim() || isPending || !canMutate}
            title={reason}
            onClick={onSubmit}
          >
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
  return <div className={cn("flex flex-col divide-y divide-border", className)}>{children}</div>;
}
