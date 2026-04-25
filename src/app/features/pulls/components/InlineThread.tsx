import { Reply } from "lucide-react";
import { useState } from "react";
import { GithubMarkdown } from "@/app/components/GithubMarkdown";
import { Avatar } from "@/app/components/ui/avatar";
import { Button } from "@/app/components/ui/button";
import {
  CommentCardReply,
} from "@/app/components/ui/CommentCard";
import { useReplyToReviewComment } from "@/app/features/pulls/hooks";
import type { ReviewComment } from "@/app/features/pulls/schemas";
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

  const allComments = [root, ...replies];

  return (
    <div className="diff-line-comment">
      <div className="sticky left-0 w-[min(640px,80vw)] py-3 pl-4 pr-4">
        <div className="flex flex-col gap-2.5">
          {allComments.map((c) => (
            <div key={c.id} className="flex gap-2.5">
              <Avatar
                login={c.user?.login ?? "ghost"}
                avatarUrl={c.user?.avatar_url}
                size="sm"
                className="mt-0.5 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="font-medium text-foreground">{c.user?.login ?? "ghost"}</span>
                  <span className="text-muted-foreground">{formatRelativeTime(c.created_at)}</span>
                </div>
                <div className="mt-0.5 text-sm text-foreground [overflow-wrap:anywhere]">
                  <div className="readme-prose max-w-none">
                    <GithubMarkdown>{c.body}</GithubMarkdown>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {replyOpen ? (
          <div className="mt-2.5">
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
          <div className="mt-2">
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setReplyOpen(true)}
            >
              <Reply data-icon="inline-start" />
              Reply
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
