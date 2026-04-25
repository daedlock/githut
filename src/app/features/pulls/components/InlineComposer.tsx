import { Send } from "lucide-react";
import { useRef, useState } from "react";
import { Avatar } from "@/app/components/ui/avatar";
import { Button } from "@/app/components/ui/button";

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
  onSubmit,
  onCancel,
  isPending,
  submitLabel = "Add comment",
  placeholder = "Leave a comment on this line…",
}: InlineComposerProps) {
  const [body, setBody] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSubmit() {
    const text = body.trim();
    if (!text || isPending) return;
    onSubmit(text);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  }

  return (
    <div className="diff-line-comment py-3 pl-4 pr-4">
      <div className="max-w-2xl flex gap-2.5">
        <Avatar login={login} avatarUrl={avatarUrl} size="sm" className="mt-1 shrink-0" />
        <div className="min-w-0 flex-1">
          <span className="text-xs font-medium text-foreground">{login}</span>
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={3}
            disabled={isPending}
            autoFocus
            className="diff-comment-input mt-1.5 w-full resize-none rounded-lg p-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-[var(--diff-comment-border)]/40"
          />
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-xs text-muted-foreground/50">
              ⌘↵ to submit
            </span>
            <div className="flex gap-1.5">
              <Button
                variant="ghost"
                size="xs"
                onClick={onCancel}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                size="xs"
                disabled={!body.trim() || isPending}
                onClick={handleSubmit}
              >
                <Send data-icon="inline-start" />
                {isPending ? "Sending…" : submitLabel}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
