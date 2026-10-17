import { useCallback, useMemo, useState } from "react";
import { Avatar } from "@/app/components/ui/avatar";
import { ComposeBox } from "@/app/components/ui/ComposeBox";
import type { MentionUser } from "@/app/hooks/useMentionSearch";
import { cn } from "@/app/lib/cn";
import { useDraft } from "@/app/stores/drafts";

export function CommentComposeCard({
  login,
  avatarUrl,
  owner,
  repo,
  placeholder = "Leave a comment",
  submitLabel = "Comment",
  cancelLabel,
  onSubmit,
  onCancel,
  isPending,
  hideAvatar,
  className,
  participants,
  rows = 4,
  autoFocus,
  draftKey,
}: {
  login: string;
  avatarUrl?: string;
  owner: string;
  repo: string;
  placeholder?: string;
  submitLabel?: string;
  cancelLabel?: string;
  onSubmit: (body: string) => void;
  onCancel?: () => void;
  isPending?: boolean;
  hideAvatar?: boolean;
  className?: string;
  participants?: MentionUser[];
  rows?: number;
  autoFocus?: boolean;
  /** Keep the text as a draft under this key (see stores/drafts). Cancel discards it. */
  draftKey?: string;
}) {
  const [localDraft, setLocalDraft] = useState("");
  const [savedDraft, setSavedDraft, discardSavedDraft] = useDraft(draftKey ?? "");
  const draft = draftKey ? savedDraft : localDraft;
  const setDraft = draftKey ? setSavedDraft : setLocalDraft;

  const handleSubmit = useCallback(() => {
    const body = draft.trim();
    if (!body || isPending) return;
    onSubmit(body);
    setDraft("");
  }, [draft, isPending, onSubmit, setDraft]);

  const handleCancel = useMemo(
    () =>
      onCancel &&
      (() => {
        if (draftKey) discardSavedDraft();
        onCancel();
      }),
    [onCancel, draftKey, discardSavedDraft],
  );

  return (
    <div className={cn(hideAvatar ? "" : "flex gap-3", className)}>
      {!hideAvatar && (
        <Avatar login={login} avatarUrl={avatarUrl} size="sm" className="mt-2 shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <ComposeBox
          owner={owner}
          repo={repo}
          value={draft}
          onChange={setDraft}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          submitLabel={submitLabel}
          cancelLabel={cancelLabel}
          submitDisabled={!draft.trim()}
          submitPending={isPending}
          placeholder={placeholder}
          rows={rows}
          autoFocus={autoFocus}
          participants={participants}
        />
      </div>
    </div>
  );
}
