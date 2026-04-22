import { useState } from "react";
import { GithubMarkdown } from "@/app/components/GithubMarkdown";
import { Avatar } from "@/app/components/ui/avatar";
import { Button } from "@/app/components/ui/button";
import { ProfileLink } from "@/app/components/user/ProfileLink";
import { useReplyToReviewComment } from "@/app/features/pulls/hooks";
import type { ReviewComment } from "@/app/features/pulls/schemas";
import { cn } from "@/app/lib/cn";
import { formatRelativeTime } from "@/app/lib/time";

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
    <div className="mx-4 my-2 overflow-hidden rounded-md border border-border bg-background">
      <ThreadComment comment={root} />
      {replies.map((r) => (
        <ThreadComment key={r.id} comment={r} />
      ))}
      {replyOpen ? (
        <div className="border-t border-border p-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Reply…"
            rows={2}
            className={cn(
              "w-full resize-none rounded-sm border border-input bg-background p-2",
              "font-mono text-caption text-foreground outline-none",
              "focus-visible:ring-1 focus-visible:ring-(--color-focus)",
            )}
            autoFocus
          />
          <div className="mt-1 flex justify-end gap-2">
            <Button
              size="xs"
              variant="ghost"
              onClick={() => { setReplyOpen(false); setBody(""); }}
            >
              Cancel
            </Button>
            <Button
              size="xs"
              disabled={!body.trim() || reply.isPending}
              onClick={handleReply}
            >
              {reply.isPending ? "Replying…" : "Reply"}
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setReplyOpen(true)}
          className={cn(
            "block w-full border-t border-border px-3 py-1.5",
            "text-caption text-muted-foreground outline-none transition-colors",
            "hover:bg-[var(--color-bg-sunken)] hover:text-foreground",
          )}
        >
          Reply…
        </button>
      )}
    </div>
  );
}

function ThreadComment({ comment }: { comment: ReviewComment }) {
  return (
    <div className="flex gap-2 border-b border-border px-3 py-2 last:border-b-0">
      <Avatar
        login={comment.user?.login ?? "ghost"}
        avatarUrl={comment.user?.avatar_url ?? ""}
        size="sm"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 text-caption">
          {comment.user ? (
            <ProfileLink login={comment.user.login} className="font-medium text-foreground">
              {comment.user.login}
            </ProfileLink>
          ) : (
            <span className="font-medium text-foreground">ghost</span>
          )}
          <span className="text-[var(--color-fg-faint)]">
            {formatRelativeTime(comment.created_at)}
          </span>
        </div>
        <div className="readme-prose mt-0.5 max-w-none text-caption">
          <GithubMarkdown>{comment.body}</GithubMarkdown>
        </div>
      </div>
    </div>
  );
}
