import { Avatar } from "@/app/components/ui/avatar";
import { CommentComposeCard } from "@/app/components/ui/CommentComposeCard";
import type { MentionUser } from "@/app/hooks/useMentionSearch";

export type InlineComposerProps = {
  login: string;
  avatarUrl?: string;
  owner: string;
  repo: string;
  onSubmit: (body: string) => void;
  onCancel: () => void;
  isPending?: boolean;
  submitLabel?: string;
  placeholder?: string;
  participants?: MentionUser[];
};

export function InlineComposer({
  login,
  avatarUrl,
  owner,
  repo,
  onSubmit,
  onCancel,
  isPending,
  submitLabel = "Add review comment",
  placeholder = "Leave a comment on this line…",
  participants,
}: InlineComposerProps) {
  return (
    <div className="diff-line-comment diff-thread py-3 pl-4 pr-4">
      <div className="max-w-2xl flex gap-2.5">
        <Avatar login={login} avatarUrl={avatarUrl} size="sm" className="mt-1 shrink-0" />
        <div className="min-w-0 flex-1">
          <span className="block text-caption font-medium text-foreground mb-1.5">
            {login}
          </span>
          <CommentComposeCard
            login={login}
            avatarUrl={avatarUrl}
            owner={owner}
            repo={repo}
            placeholder={placeholder}
            submitLabel={submitLabel}
            cancelLabel="Cancel"
            onSubmit={onSubmit}
            onCancel={onCancel}
            isPending={isPending}
            participants={participants}
            rows={3}
            autoFocus
            hideAvatar
          />
        </div>
      </div>
    </div>
  );
}
