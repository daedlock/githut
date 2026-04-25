import { useState } from "react";
import { Avatar } from "@/app/components/ui/avatar";
import { Button } from "@/app/components/ui/button";
import { ComposeBox } from "@/app/components/ui/ComposeBox";

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
};

export function InlineComposer({
  login,
  avatarUrl,
  owner,
  repo,
  onSubmit,
  onCancel,
  isPending,
  submitLabel = "Add comment",
  placeholder = "Leave a comment on this line…",
}: InlineComposerProps) {
  const [body, setBody] = useState("");

  return (
    <div className="diff-line-comment">
      <div className="sticky left-0 w-[min(640px,80vw)] py-3 pl-4 pr-4">
        <div className="flex gap-2.5">
          <Avatar login={login} avatarUrl={avatarUrl} size="sm" className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <span className="text-xs font-medium text-foreground">{login}</span>
            <div className="mt-1.5">
              <ComposeBox
                owner={owner}
                repo={repo}
                value={body}
                onChange={setBody}
                placeholder={placeholder}
                rows={3}
                autoFocus
                disabled={isPending}
              />
            </div>
            <div className="mt-2 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={onCancel} disabled={isPending}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!body.trim() || isPending}
                onClick={() => onSubmit(body.trim())}
              >
                {isPending ? "Submitting…" : submitLabel}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
