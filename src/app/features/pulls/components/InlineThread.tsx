import { useState } from "react";
import { GithubMarkdown } from "@/app/components/GithubMarkdown";
import {
  CommentCardDisplay,
  CommentCardReply,
  CommentThread,
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
          <CommentCardDisplay
            login={root.user?.login ?? "ghost"}
            avatarUrl={root.user?.avatar_url}
            date={root.created_at}
            inline
          >
            <div className="readme-prose max-w-none text-sm">
              <GithubMarkdown>{root.body}</GithubMarkdown>
            </div>
          </CommentCardDisplay>
        </div>
        {replies.map((r) => (
          <div key={r.id} className="p-3 pt-0">
            <CommentCardDisplay
              login={r.user?.login ?? "ghost"}
              avatarUrl={r.user?.avatar_url}
              date={r.created_at}
              inline
            >
              <div className="readme-prose max-w-none text-sm">
                <GithubMarkdown>{r.body}</GithubMarkdown>
              </div>
            </CommentCardDisplay>
          </div>
        ))}
      </CommentThread>

      {replyOpen ? (
        <div className="border-t border-border p-3">
          <CommentCardReply
            login={root.user?.login ?? "ghost"}
            avatarUrl={root.user?.avatar_url}
            value={body}
            onChange={setBody}
            onSubmit={handleReply}
            onCancel={() => { setReplyOpen(false); setBody(""); }}
            isPending={reply.isPending}
          />
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
