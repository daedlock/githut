import { useState } from "react";
import { GithubMarkdown } from "@/app/components/GithubMarkdown";
import {
  CommentInline,
  CommentThread,
  CommentComposer,
} from "@/app/components/ui/CommentCard";
import { useReplyToReviewComment } from "@/app/features/pulls/hooks";
import type { ReviewComment } from "@/app/features/pulls/schemas";
import { cn } from "@/app/lib/cn";

export type InlineThreadProps = {
  owner: string;
  repo: string;
  number: number;
  root: ReviewComment;
  replies: ReviewComment[];
};

export function InlineThread({
  owner,
  repo,
  number,
  root,
  replies,
}: InlineThreadProps) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [body, setBody] = useState("");
  const reply = useReplyToReviewComment(owner, repo, number);

  function handleReply() {
    const text = body.trim();
    if (!text || reply.isPending) return;
    reply.mutate(
      { inReplyToId: root.id, body: text },
      { onSuccess: () => { setBody(""); setReplyOpen(false); } },
    );
  }

  return (
    <div className="sticky left-0 mx-4 my-2 max-w-[calc(100cqi-3rem)] overflow-hidden rounded-lg border border-border bg-background">
      <CommentThread>
        <div className="p-3">
          <CommentInline
            login={root.user?.login ?? "ghost"}
            avatarUrl={root.user?.avatar_url}
            date={root.created_at}
          >
            <div className="readme-prose max-w-none text-sm">
              <GithubMarkdown>{root.body}</GithubMarkdown>
            </div>
          </CommentInline>
        </div>
        {replies.map((r) => (
          <div key={r.id} className="p-3 pt-0">
            <CommentInline
              login={r.user?.login ?? "ghost"}
              avatarUrl={r.user?.avatar_url}
              date={r.created_at}
            >
              <div className="readme-prose max-w-none text-sm">
                <GithubMarkdown>{r.body}</GithubMarkdown>
              </div>
            </CommentInline>
          </div>
        ))}
      </CommentThread>

      {replyOpen ? (
        <div className="border-t border-border p-3">
          <div className="flex gap-2.5">
            <div className="size-6 flex-shrink-0" /> {/* Spacer for alignment */}
            <div className="min-w-0 flex-1">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Reply…"
                rows={2}
                className={cn(
                  "w-full resize-none rounded-lg border border-input bg-background p-2.5",
                  "text-sm text-foreground placeholder:text-muted-foreground",
                  "focus:outline-none focus:ring-2 focus:ring-ring/40",
                )}
                autoFocus
              />
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-medium",
                    "text-muted-foreground hover:text-foreground transition-colors",
                  )}
                  onClick={() => { setReplyOpen(false); setBody(""); }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={cn(
                    "rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground",
                    "transition-colors hover:bg-primary/90",
                    "disabled:pointer-events-none disabled:opacity-50",
                  )}
                  disabled={!body.trim() || reply.isPending}
                  onClick={handleReply}
                >
                  {reply.isPending ? "Replying…" : "Reply"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setReplyOpen(true)}
          className={cn(
            "block w-full border-t border-border px-3 py-2",
            "text-xs text-muted-foreground outline-none transition-colors",
            "hover:bg-muted hover:text-foreground",
          )}
        >
          Reply…
        </button>
      )}
    </div>
  );
}
