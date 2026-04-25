import { useState } from "react";
import { GithubMarkdown } from "@/app/components/GithubMarkdown";
import {
  CommentCardDisplay,
  CommentCardReply,
} from "@/app/components/ui/CommentCard";
import { useReplyToReviewComment } from "@/app/features/pulls/hooks";
import type { ReviewComment } from "@/app/features/pulls/schemas";

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
    <div className="sticky left-0 mx-4 my-2 max-w-[calc(100cqi-3rem)] overflow-hidden rounded-lg bg-muted">
      <div className="flex flex-col gap-3 p-3">
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
        {replies.map((r) => (
          <CommentCardDisplay
            key={r.id}
            login={r.user?.login ?? "ghost"}
            avatarUrl={r.user?.avatar_url}
            date={r.created_at}
            inline
          >
            <div className="readme-prose max-w-none text-sm">
              <GithubMarkdown>{r.body}</GithubMarkdown>
            </div>
          </CommentCardDisplay>
        ))}
      </div>

      {replyOpen ? (
        <div className="bg-background/50 p-3">
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
          className="block w-full px-3 py-2 text-xs text-muted-foreground outline-none transition-colors hover:bg-background/50 hover:text-foreground"
        >
          Reply…
        </button>
      )}
    </div>
  );
}
