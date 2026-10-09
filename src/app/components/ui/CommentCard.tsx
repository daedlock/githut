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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import { ProfileLink } from "@/app/components/user/ProfileLink";
import { ReactionsBar } from "@/app/features/issues/components/ReactionsBar";
import {
  EMPTY_MY_REACTIONS,
  type MyReactionsMap,
  type ReactionContent,
  type ReactionsMap,
} from "@/app/features/issues/schemas";
import type { MentionUser } from "@/app/hooks/useMentionSearch";
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

  const editor = editingAvailable && (
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
      rows={inline ? 4 : 5}
      autoFocus
      participants={participants}
    />
  );

  // ── Inline variant (review threads, compact contexts) ──────────────────
  if (inline) {
    return (
      <div className={cn("flex gap-2.5", className)}>
        <Avatar login={login} avatarUrl={avatarUrl} size="sm" className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex min-h-6 flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <ProfileLink login={login} className="text-ui font-medium text-foreground">
              {login}
            </ProfileLink>
            {isAuthor && <AuthorBadge />}
            {date && (
              <span className="text-caption tabular-nums text-muted-foreground">
                {formatRelativeTime(date)}
              </span>
            )}
            {actions}
            {menuButton && <div className="ml-auto">{menuButton}</div>}
          </div>
          <BodySwap
            editing={editing}
            display={<div className="mt-1 text-body">{children}</div>}
            editor={editor && <div className="mt-1.5">{editor}</div>}
          />
          {!editing && showReactions && (
            <ReactionsBar
              reactions={reactions}
              myReactions={myReactions ?? EMPTY_MY_REACTIONS}
              onToggle={onToggleReaction}
              className="mt-1.5"
            />
          )}
        </div>
      </div>
    );
  }

  // ── Comment block (default — issues, PR conversation, reviews) ─────────
  return (
    <Card variant="muted" className={className}>
      <div className="flex h-10 items-center gap-2 px-4">
        <Avatar login={login} avatarUrl={avatarUrl} size="sm" className="shrink-0" />
        <ProfileLink login={login} className="min-w-0 truncate text-ui font-medium text-foreground">
          {login}
        </ProfileLink>
        {isAuthor && <AuthorBadge />}
        {date && (
          <span className="shrink-0 text-ui text-muted-foreground">
            commented <span className="tabular-nums">{formatRelativeTime(date)}</span>
          </span>
        )}
        {(actions || menuButton) && (
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {actions}
            {menuButton}
          </div>
        )}
      </div>
      <BodySwap
        editing={editing}
        display={
          <div className="px-4 pb-4">
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
        editor={editor && <div className="px-4 pb-4">{editor}</div>}
      />
    </Card>
  );
}

function AuthorBadge() {
  return (
    <span className="inline-flex h-4 shrink-0 items-center rounded-sm bg-accent px-1.5 text-micro font-medium text-muted-foreground">
      Author
    </span>
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
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(
    () => () => {
      if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
    },
    [],
  );

  function handleDelete(e: Event) {
    if (!onDelete) return;
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
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              disabled={disabled}
              aria-label="Comment actions"
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Comment actions</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" sideOffset={4} className="min-w-36">
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil />
          Edit
        </DropdownMenuItem>
        {onDelete && (
          <DropdownMenuItem
            variant="destructive"
            onSelect={handleDelete}
            onPointerLeave={() => {
              if (!confirmingDelete) return;
              setConfirmingDelete(false);
              if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
            }}
          >
            <Trash2 />
            {confirmingDelete ? "Click again to confirm" : "Delete"}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
