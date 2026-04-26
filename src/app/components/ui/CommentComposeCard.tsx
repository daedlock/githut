import { useState, useCallback } from "react";
import { Avatar } from "@/app/components/ui/avatar";
import { ComposeBox } from "@/app/components/ui/ComposeBox";
import { cn } from "@/app/lib/cn";

export function CommentComposeCard({
  login,
  avatarUrl,
  owner,
  repo,
  placeholder = "Leave a comment",
  submitLabel = "Comment",
  onSubmit,
  isPending,
  hideAvatar,
  className,
}: {
  login: string;
  avatarUrl?: string;
  owner: string;
  repo: string;
  placeholder?: string;
  submitLabel?: string;
  onSubmit: (body: string) => void;
  isPending?: boolean;
  hideAvatar?: boolean;
  className?: string;
}) {
  const [draft, setDraft] = useState("");

  const handleSubmit = useCallback(() => {
    const body = draft.trim();
    if (!body || isPending) return;
    onSubmit(body);
    setDraft("");
  }, [draft, isPending, onSubmit]);

  return (
    <div className={cn(hideAvatar ? "" : "flex gap-3", className)}>
      {!hideAvatar && <Avatar login={login} avatarUrl={avatarUrl} size="sm" className="mt-2 shrink-0" />}
      <div className="min-w-0 flex-1">
        <ComposeBox
          owner={owner}
          repo={repo}
          value={draft}
          onChange={setDraft}
          onSubmit={handleSubmit}
          submitLabel={submitLabel}
          submitDisabled={!draft.trim()}
          submitPending={isPending}
          placeholder={placeholder}
          rows={4}
        />
      </div>
    </div>
  );
}
