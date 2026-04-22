import { MessageSquare } from "lucide-react";
import { useMemo, useState } from "react";
import { GithubMarkdown } from "@/app/components/GithubMarkdown";
import { Avatar } from "@/app/components/ui/avatar";
import { Button } from "@/app/components/ui/button";
import { Textarea } from "@/app/components/ui/textarea";
import { ProfileLink } from "@/app/components/user/ProfileLink";
import {
  usePrReviewComments,
  useReplyToReviewComment,
} from "@/app/features/pulls/hooks";
import type { ReviewComment } from "@/app/features/pulls/schemas";
import { cn } from "@/app/lib/cn";
import { formatRelativeTime } from "@/app/lib/time";

// ─── InlineCommentsSection ─────────────────────────────────────────────────
//
// Rendered above DiffLayout on the Files tab. Shows existing review
// comments grouped by file and thread (`in_reply_to_id` chains), with a
// reply box per thread. A future iteration will inline-inject these
// between diff rows; for P5 MVP the grouped-thread view lets reviewers
// see and respond to conversations without leaving the diff tab.

type Thread = {
  root: ReviewComment;
  replies: ReviewComment[];
};

type FileGroup = {
  path: string;
  threads: Thread[];
};

export function InlineCommentsSection({
  owner,
  repo,
  number,
}: {
  owner: string;
  repo: string;
  number: number;
}) {
  const commentsQuery = usePrReviewComments(owner, repo, number);
  const comments = commentsQuery.data ?? [];

  const groups = useMemo<FileGroup[]>(() => groupThreadsByFile(comments), [comments]);

  if (groups.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center gap-2 text-body">
        <MessageSquare className="size-4 text-[var(--color-fg-faint)]" />
        <span className="font-medium text-foreground">
          Review comments
        </span>
        <span className="text-caption text-muted-foreground">
          {comments.length} {comments.length === 1 ? "comment" : "comments"} across{" "}
          {groups.length} {groups.length === 1 ? "file" : "files"}
        </span>
      </header>

      <div className="flex flex-col gap-3">
        {groups.map((g) => (
          <FileGroupCard
            key={g.path}
            group={g}
            owner={owner}
            repo={repo}
            number={number}
          />
        ))}
      </div>
    </section>
  );
}

function FileGroupCard({
  group,
  owner,
  repo,
  number,
}: {
  group: FileGroup;
  owner: string;
  repo: string;
  number: number;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div className="border-b border-border bg-[var(--color-bg-subtle)] px-3 py-2">
        <span className="font-mono text-caption text-foreground">
          {group.path}
        </span>
      </div>
      <div className="flex flex-col gap-0 divide-y divide-border">
        {group.threads.map((t) => (
          <ThreadCard
            key={t.root.id}
            thread={t}
            owner={owner}
            repo={repo}
            number={number}
          />
        ))}
      </div>
    </div>
  );
}

function ThreadCard({
  thread,
  owner,
  repo,
  number,
}: {
  thread: Thread;
  owner: string;
  repo: string;
  number: number;
}) {
  const { root, replies } = thread;
  const line = root.line ?? root.original_line;

  return (
    <div className="flex flex-col gap-2 px-3 py-3">
      {line != null && root.diff_hunk && (
        <pre
          aria-label={`Diff context for line ${line}`}
          className="max-h-40 overflow-hidden rounded-sm bg-[var(--color-bg-sunken)] px-2 py-1.5 font-mono text-micro text-muted-foreground"
        >
          {tailOfHunk(root.diff_hunk)}
        </pre>
      )}
      <CommentRow comment={root} />
      {replies.map((r) => (
        <CommentRow key={r.id} comment={r} isReply />
      ))}
      <ReplyBox
        owner={owner}
        repo={repo}
        number={number}
        inReplyToId={root.id}
      />
    </div>
  );
}

function CommentRow({
  comment,
  isReply,
}: {
  comment: ReviewComment;
  isReply?: boolean;
}) {
  return (
    <div className={cn("flex gap-2", isReply && "pl-4")}>
      <Avatar
        login={comment.user?.login ?? "ghost"}
        avatarUrl={comment.user?.avatar_url ?? ""}
        size="sm"
      />
      <div className="min-w-0 flex-1">
        <div className="text-caption">
          {comment.user ? (
            <ProfileLink
              login={comment.user.login}
              className="font-medium text-foreground"
            >
              {comment.user.login}
            </ProfileLink>
          ) : (
            <span className="font-medium text-foreground">ghost</span>
          )}{" "}
          <span className="text-muted-foreground">
            commented {formatRelativeTime(comment.created_at)}
          </span>
        </div>
        <div className="readme-prose mt-1 max-w-none text-body">
          <GithubMarkdown>{comment.body}</GithubMarkdown>
        </div>
      </div>
    </div>
  );
}

function ReplyBox({
  owner,
  repo,
  number,
  inReplyToId,
}: {
  owner: string;
  repo: string;
  number: number;
  inReplyToId: number;
}) {
  const [body, setBody] = useState("");
  const reply = useReplyToReviewComment(owner, repo, number);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || reply.isPending) return;
    reply.mutate(
      { inReplyToId, body: text },
      {
        onSuccess: () => setBody(""),
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 pl-4">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Reply…"
        rows={2}
        className="font-mono text-caption"
      />
      <div className="flex justify-end">
        <Button
          type="submit"
          size="sm"
          variant="secondary"
          disabled={!body.trim() || reply.isPending}
        >
          {reply.isPending ? "Replying…" : "Reply"}
        </Button>
      </div>
    </form>
  );
}

// ─── Grouping helpers ──────────────────────────────────────────────────────

function groupThreadsByFile(comments: ReviewComment[]): FileGroup[] {
  const byId = new Map<number, ReviewComment>();
  for (const c of comments) byId.set(c.id, c);

  // Threads keyed by their root id (the first comment in the chain).
  const threads = new Map<number, Thread>();

  for (const c of comments) {
    const rootId = rootIdFor(c, byId);
    let t = threads.get(rootId);
    if (!t) {
      const rootComment = byId.get(rootId) ?? c;
      t = { root: rootComment, replies: [] };
      threads.set(rootId, t);
    }
    if (c.id !== rootId) t.replies.push(c);
  }

  // Sort replies chronologically within each thread.
  for (const t of threads.values()) {
    t.replies.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  }

  // Collect by path, preserving first-seen order.
  const pathOrder: string[] = [];
  const byPath = new Map<string, Thread[]>();
  const rootsSorted = [...threads.values()].sort(
    (a, b) => (a.root.created_at < b.root.created_at ? -1 : 1),
  );
  for (const t of rootsSorted) {
    if (!byPath.has(t.root.path)) {
      byPath.set(t.root.path, []);
      pathOrder.push(t.root.path);
    }
    byPath.get(t.root.path)!.push(t);
  }

  return pathOrder.map((path) => ({ path, threads: byPath.get(path)! }));
}

function rootIdFor(c: ReviewComment, byId: Map<number, ReviewComment>): number {
  let current: ReviewComment = c;
  const seen = new Set<number>();
  while (current.in_reply_to_id && !seen.has(current.id)) {
    seen.add(current.id);
    const next = byId.get(current.in_reply_to_id);
    if (!next) break;
    current = next;
  }
  return current.id;
}

function tailOfHunk(hunk: string): string {
  // Show the last ~4 lines of the hunk so the diff context is immediately
  // recognizable without overwhelming the thread card.
  const lines = hunk.split("\n");
  return lines.slice(-4).join("\n");
}
