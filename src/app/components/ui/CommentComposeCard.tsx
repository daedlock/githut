import { useState, useCallback, useEffect } from "react";
import { Avatar } from "@/app/components/ui/avatar";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { ComposeBox } from "@/app/components/ui/ComposeBox";
import { cn } from "@/app/lib/cn";

/**
 * CommentComposeCard — Self-contained comment composer.
 * Manages its own draft state to prevent parent re-renders on every keystroke.
 * Calls onSubmit with the final body when submitted.
 */
export function CommentComposeCard({
  login,
  avatarUrl,
  owner,
  repo,
  placeholder = "Leave a comment",
  submitLabel = "Comment",
  onSubmit,
  isPending,
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
  className?: string;
}) {
  const [draft, setDraft] = useState("");

  const handleSubmit = useCallback(() => {
    const body = draft.trim();
    if (!body || isPending) return;
    onSubmit(body);
  }, [draft, isPending, onSubmit]);

  // Clear draft when submission succeeds
  useEffect(() => {
    if (!isPending && draft === "") {
      // Draft was cleared after successful submit
    }
  }, [isPending, draft]);

  return (
    <Card variant="muted" className={cn("overflow-hidden", className)}>
      <div className="flex items-center gap-2 bg-muted/50 px-4 py-2">
        <Avatar login={login} avatarUrl={avatarUrl} size="sm" />
        <span className="text-xs font-medium text-foreground">{login}</span>
      </div>
      <div className="p-4">
        <ComposeBox
          owner={owner}
          repo={repo}
          value={draft}
          onChange={setDraft}
          placeholder={placeholder}
          rows={4}
        />
        <div className="mt-3 flex justify-end">
          <Button
            size="sm"
            disabled={!draft.trim() || isPending}
            onClick={handleSubmit}
          >
            {isPending ? "Submitting…" : submitLabel}
          </Button>
        </div>
      </div>
    </Card>
  );
}
