import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Check,
  ChevronRight,
  EyeOff,
  FileCode,
  MessageSquare,
  Reply,
  RotateCcw,
  X,
} from "lucide-react";
import { GithubMarkdown } from "@/app/components/GithubMarkdown";
import { CommentCardDisplay } from "@/app/components/ui/CommentCard";
import { CommentComposeCard } from "@/app/components/ui/CommentComposeCard";
import { Button } from "@/app/components/ui/button";
import { ProfileLink } from "@/app/components/user/ProfileLink";
import {
  useDeleteReviewComment,
  useMyReviewCommentReactions,
  useReplyToReviewComment,
  useResolveThread,
  useThreadResolution,
  useToggleReviewCommentReaction,
  useUpdateReviewComment,
} from "@/app/features/pulls/hooks";
import type { Review, ReviewComment, ReviewState } from "@/app/features/pulls/schemas";
import { EMPTY_MY_REACTIONS, type ReactionContent } from "@/app/features/issues/schemas";
import type { MentionUser } from "@/app/hooks/useMentionSearch";
import { useMe } from "@/app/hooks/useMe";
import { cn } from "@/app/lib/cn";
import { formatRelativeTime } from "@/app/lib/time";
import { draftKey, draftPage, hasDraft } from "@/app/stores/drafts";

// ─── State styling ─────────────────────────────────────────────────────────

type Tone = {
  rail: string;
  headerTint: string;
  iconRing: string;
  iconColor: string;
  label: string;
  Icon: typeof Check;
};

function tone(state: ReviewState): Tone {
  switch (state) {
    case "APPROVED":
      return {
        rail: "before:bg-[var(--color-success)]",
        headerTint:
          "bg-[color-mix(in_oklab,var(--color-success)_10%,var(--color-muted))]",
        iconRing: "ring-[color-mix(in_oklab,var(--color-success)_40%,transparent)]",
        iconColor: "text-[var(--color-success)]",
        label: "Approved",
        Icon: Check,
      };
    case "CHANGES_REQUESTED":
      return {
        rail: "before:bg-[var(--color-danger)]",
        headerTint:
          "bg-[color-mix(in_oklab,var(--color-danger)_10%,var(--color-muted))]",
        iconRing: "ring-[color-mix(in_oklab,var(--color-danger)_40%,transparent)]",
        iconColor: "text-[var(--color-danger)]",
        label: "Requested changes",
        Icon: X,
      };
    case "DISMISSED":
      return {
        rail: "before:bg-border",
        headerTint: "bg-muted/50",
        iconRing: "ring-border",
        iconColor: "text-[var(--color-fg-faint)]",
        label: "Dismissed",
        Icon: EyeOff,
      };
    case "PENDING":
      return {
        rail: "before:bg-[var(--color-warning)]",
        headerTint:
          "bg-[color-mix(in_oklab,var(--color-warning)_10%,var(--color-muted))]",
        iconRing: "ring-[color-mix(in_oklab,var(--color-warning)_40%,transparent)]",
        iconColor: "text-[var(--color-warning)]",
        label: "Pending review",
        Icon: MessageSquare,
      };
    case "COMMENTED":
    default:
      return {
        rail: "before:bg-border",
        headerTint: "bg-muted/50",
        iconRing: "ring-border",
        iconColor: "text-muted-foreground",
        label: "Reviewed",
        Icon: MessageSquare,
      };
  }
}

// ─── Thread grouping ───────────────────────────────────────────────────────

type Thread = { root: ReviewComment; replies: ReviewComment[] };
type FileGroup = { path: string; threads: Thread[] };

function groupByFile(comments: ReviewComment[]): FileGroup[] {
  const roots: ReviewComment[] = [];
  const repliesByRoot = new Map<number, ReviewComment[]>();

  for (const c of comments) {
    if (c.in_reply_to_id) {
      const arr = repliesByRoot.get(c.in_reply_to_id) ?? [];
      arr.push(c);
      repliesByRoot.set(c.in_reply_to_id, arr);
    } else {
      roots.push(c);
    }
  }

  const byPath = new Map<string, Thread[]>();
  for (const root of roots) {
    const replies = (repliesByRoot.get(root.id) ?? []).slice().sort(
      (a, b) => (a.created_at < b.created_at ? -1 : 1),
    );
    const arr = byPath.get(root.path) ?? [];
    arr.push({ root, replies });
    byPath.set(root.path, arr);
  }

  return Array.from(byPath.entries())
    .map(([path, threads]) => ({
      path,
      threads: threads.sort((a, b) => {
        const al = a.root.line ?? a.root.original_line ?? 0;
        const bl = b.root.line ?? b.root.original_line ?? 0;
        return al - bl;
      }),
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

// ─── Diff hunk excerpt ─────────────────────────────────────────────────────

function HunkExcerpt({ hunk }: { hunk: string }) {
  const lines = hunk.split("\n").filter((l) => l.length > 0);
  // Drop the @@ header, show last 4 lines (the comment is anchored at the tail).
  const tail = lines
    .filter((l) => !l.startsWith("@@"))
    .slice(-4);

  return (
    <div className="overflow-hidden rounded-md border border-border/60 bg-[var(--color-code-bg)] font-mono text-code leading-[1.55]">
      {tail.map((line, i) => {
        const sigil = line[0];
        const isAdd = sigil === "+";
        const isDel = sigil === "-";
        return (
          <div
            key={i}
            className={cn(
              "px-3 py-px",
              isAdd && "bg-[var(--diff-add-bg)] text-foreground",
              isDel && "bg-[var(--diff-del-bg)] text-foreground",
              !isAdd && !isDel && "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "select-none pr-2",
                isAdd && "text-[var(--color-success)]",
                isDel && "text-[var(--color-danger)]",
                !isAdd && !isDel && "text-[var(--color-fg-faint)]",
              )}
            >
              {sigil === "+" || sigil === "-" || sigil === " " ? sigil : " "}
            </span>
            <span className="whitespace-pre">{line.slice(1)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Comment row (single comment in a thread) ────────────────────────────

function ThreadComment({
  comment,
  owner,
  repo,
  number,
  meId,
  meLogin,
  participants,
  onToggleReaction,
}: {
  comment: ReviewComment;
  owner: string;
  repo: string;
  number: number;
  meId: number | undefined;
  meLogin: string | undefined;
  participants: MentionUser[];
  onToggleReaction: (content: ReactionContent, existingId?: number) => void;
}) {
  const myReactionsQuery = useMyReviewCommentReactions(owner, repo, comment.id, meId);
  const myReactions = myReactionsQuery.data ?? EMPTY_MY_REACTIONS;
  const updateMutation = useUpdateReviewComment(owner, repo, number);
  const deleteMutation = useDeleteReviewComment(owner, repo, number);
  const isMine = !!meLogin && !!comment.user && meLogin === comment.user.login;

  return (
    <CommentCardDisplay
      inline
      login={comment.user?.login ?? "ghost"}
      avatarUrl={comment.user?.avatar_url}
      date={comment.created_at}
      reactions={comment.reactions}
      myReactions={myReactions}
      onToggleReaction={onToggleReaction}
      canEdit={isMine}
      rawBody={comment.body}
      onSave={async (next) => {
        await updateMutation.mutateAsync({ commentId: comment.id, body: next });
      }}
      onDelete={async () => {
        await deleteMutation.mutateAsync({ commentId: comment.id });
      }}
      participants={participants}
      repoOwner={owner}
      repoName={repo}
      isSaving={updateMutation.isPending || deleteMutation.isPending}
    >
      <div className="readme-prose max-w-none [overflow-wrap:anywhere]">
        <GithubMarkdown repoContext={{ owner, repo }}>{comment.body}</GithubMarkdown>
      </div>
    </CommentCardDisplay>
  );
}

// ─── Thread block — interactive (reply, resolve, reactions) ────────────────

function ThreadBlock({
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
  const replyDraftKey = draftKey(draftPage(owner, repo, number), `reply:${thread.root.id}`);
  const [replyOpen, setReplyOpen] = useState(() => hasDraft(replyDraftKey));
  const [expandedAfterResolve, setExpandedAfterResolve] = useState(false);

  const meQuery = useMe();
  const meId = meQuery.data?.id;
  const meLogin = meQuery.data?.login;
  const replyMutation = useReplyToReviewComment(owner, repo, number, meQuery.data);
  const toggleReaction = useToggleReviewCommentReaction(owner, repo, number, meId);

  const resolutionQuery = useThreadResolution(owner, repo, number);
  const resolveMutation = useResolveThread(owner, repo, number);
  const threadInfo = resolutionQuery.data?.get(thread.root.id);
  const isResolved = threadInfo?.isResolved ?? false;
  const threadNodeId = threadInfo?.threadNodeId;

  const allComments = useMemo(() => [thread.root, ...thread.replies], [thread]);
  const lastComment = allComments[allComments.length - 1]!;
  const showCollapsed = isResolved && !expandedAfterResolve;

  // Seed @ autocomplete with thread participants
  const participants = useMemo((): MentionUser[] => {
    const seen = new Set<string>();
    const list: MentionUser[] = [];
    for (const c of allComments) {
      if (!c.user || seen.has(c.user.login)) continue;
      seen.add(c.user.login);
      list.push({
        kind: "@",
        id: c.user.login,
        login: c.user.login,
        avatar: c.user.avatar_url,
      });
    }
    return list;
  }, [allComments]);

  function handleReply(body: string) {
    if (!body || replyMutation.isPending) return;
    // Fire-and-forget: optimistic insertion happens in onMutate, so close
    // the box immediately for instant feedback.
    replyMutation.mutate({ inReplyToId: thread.root.id, body });
    setReplyOpen(false);
  }

  function handleResolveToggle() {
    if (!threadNodeId || resolveMutation.isPending) return;
    resolveMutation.mutate({ threadNodeId, resolve: !isResolved });
  }

  // ── Collapsed resolved strip ─────────────────────────────────────────────
  if (showCollapsed) {
    return (
      <button
        type="button"
        onClick={() => setExpandedAfterResolve(true)}
        className={cn(
          "group flex w-full items-center gap-2 rounded-md border border-border/60 bg-background px-3 py-2",
          "text-left outline-none transition-colors",
          "hover:bg-[var(--color-bg-sunken)] focus-visible:ring-1 focus-visible:ring-foreground/15",
        )}
      >
        <span className="inline-flex size-4 items-center justify-center">
          <ChevronRight className="size-3.5 text-[var(--color-fg-faint)] transition-colors group-hover:text-muted-foreground" />
        </span>
        <span className="inline-flex size-4 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--color-success)_20%,transparent)]">
          <Check className="size-2.5 text-[var(--color-success)]" strokeWidth={3} />
        </span>
        <span className="min-w-0 flex-1 truncate text-caption">
          <span className="text-foreground">Resolved</span>
          <span className="text-[var(--color-fg-faint)]">
            {" "}
            by{" "}
            <span className="text-muted-foreground">
              {lastComment.user?.login ?? "ghost"}
            </span>
            {" — "}
          </span>
          <span className="text-muted-foreground">
            {thread.root.body.length > 60
              ? `${thread.root.body.slice(0, 60)}…`
              : thread.root.body}
          </span>
        </span>
      </button>
    );
  }

  // ── Full expanded thread ────────────────────────────────────────────────
  return (
    <div
      className={cn(
        "rounded-md border bg-background",
        isResolved
          ? "border-[color-mix(in_oklab,var(--color-success)_30%,var(--color-border))]"
          : "border-border/60",
      )}
    >
      {/* Resolved chip at top */}
      {isResolved && (
        <div className="flex items-center gap-1.5 border-b border-border/60 bg-[color-mix(in_oklab,var(--color-success)_8%,var(--color-bg-subtle))] px-3 py-1.5 text-caption text-[var(--color-success)]">
          <Check className="size-3" strokeWidth={3} />
          <span className="font-medium uppercase tracking-wider">Resolved</span>
        </div>
      )}

      <div className="space-y-3 p-3">
        <HunkExcerpt hunk={thread.root.diff_hunk} />

        <div className="space-y-3">
          {allComments.map((c) => (
            <ThreadComment
              key={c.id}
              comment={c}
              owner={owner}
              repo={repo}
              number={number}
              meId={meId}
              meLogin={meLogin}
              participants={participants}
              onToggleReaction={(content, existingId) =>
                toggleReaction.mutate({
                  commentId: c.id,
                  content,
                  existingReactionId: existingId,
                })
              }
            />
          ))}
        </div>

        {/* Reply composer / actions row */}
        {replyOpen ? (
          <div className="border-t border-border/60 pt-3">
            <CommentComposeCard
              login={meQuery.data?.login ?? "ghost"}
              avatarUrl={meQuery.data?.avatar_url}
              owner={owner}
              repo={repo}
              onSubmit={handleReply}
              onCancel={() => setReplyOpen(false)}
              draftKey={replyDraftKey}
              isPending={replyMutation.isPending}
              placeholder="Reply to this thread…"
              submitLabel="Reply"
              participants={participants}
              rows={3}
              autoFocus
            />
          </div>
        ) : (
          <div className="-mx-1 flex items-center gap-1 border-t border-border/60 pt-2">
            <Button variant="ghost" size="xs" onClick={() => setReplyOpen(true)}>
              <Reply data-icon="inline-start" />
              Reply
            </Button>
            {threadNodeId && (
              <Button
                variant="ghost"
                size="xs"
                onClick={handleResolveToggle}
                disabled={resolveMutation.isPending}
                className={cn(
                  isResolved && "text-[var(--color-fg-faint)] hover:text-foreground",
                )}
              >
                {isResolved ? (
                  <RotateCcw data-icon="inline-start" />
                ) : (
                  <Check data-icon="inline-start" />
                )}
                {isResolved ? "Unresolve" : "Resolve"}
              </Button>
            )}
              {isResolved && expandedAfterResolve && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setExpandedAfterResolve(false)}
                >
                  Collapse
                </Button>
              )}
          </div>
        )}
      </div>
    </div>
  );
}

function FileSection({
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
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <FileCode className="size-3.5 shrink-0 text-[var(--color-fg-faint)]" />
        <span className="truncate font-mono text-caption text-muted-foreground">
          {group.path}
        </span>
        <span className="text-caption text-[var(--color-fg-faint)]">
          · {group.threads.length} {group.threads.length === 1 ? "thread" : "threads"}
        </span>
      </div>
      <div className="space-y-2">
        {group.threads.map((t) => (
          <ThreadBlock
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

// ─── ReviewCard ────────────────────────────────────────────────────────────

export function ReviewCard({
  review,
  inlineComments = [],
  owner,
  repo,
  number,
}: {
  review: Review;
  inlineComments?: ReviewComment[];
  owner: string;
  repo: string;
  number: number;
}) {
  const t = tone(review.state);
  const Icon = t.Icon;
  const fileGroups = useMemo(() => groupByFile(inlineComments), [inlineComments]);
  const replyOnlyCount = useMemo(
    () => inlineComments.filter((c) => c.in_reply_to_id).length,
    [inlineComments],
  );
  const newRootCount = useMemo(
    () => inlineComments.filter((c) => !c.in_reply_to_id).length,
    [inlineComments],
  );
  const newThreadCount = useMemo(
    () => fileGroups.reduce((acc, g) => acc + g.threads.length, 0),
    [fileGroups],
  );
  const hasBody = !!review.body?.trim();
  const hasNewThreads = newRootCount > 0;
  const hasOnlyReplies = replyOnlyCount > 0 && !hasNewThreads;

  const [open, setOpen] = useState(true);

  // Compact strip when there's no full content to show:
  //   - truly empty review (no body, no inline activity), or
  //   - reply-only review (only replies, no root threads, no body).
  // A review with a root inline comment (even if no body) gets the full card.
  const isEmpty = !hasBody && newRootCount === 0 && replyOnlyCount === 0;
  if (isEmpty || (!hasBody && hasOnlyReplies)) {
    const detail = hasOnlyReplies ? (
      <>
        replied{" "}
        <span className="text-[var(--color-fg-faint)]">
          to {replyOnlyCount === 1 ? "a thread" : `${replyOnlyCount} comments`}
        </span>
      </>
    ) : (
      <>
        <span
          className={cn(
            review.state === "DISMISSED" && "italic line-through text-[var(--color-fg-faint)]",
          )}
        >
          {t.label.toLowerCase()}
        </span>{" "}
        <span className="text-[var(--color-fg-faint)]">without a comment</span>
      </>
    );
    return (
      <div
        className={cn(
          "relative flex items-center gap-2.5 overflow-hidden rounded-md bg-muted py-1.5 pl-3 pr-3.5",
          "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0.5",
          t.rail,
        )}
      >
        <span className={cn("inline-flex size-4 items-center justify-center", t.iconColor)}>
          {hasOnlyReplies ? (
            <Reply className="size-3.5" strokeWidth={2.5} />
          ) : (
            <Icon className="size-3.5" strokeWidth={2.5} />
          )}
        </span>
        <span className="text-caption text-foreground">
          <ProfileLink
            login={review.user?.login ?? "ghost"}
            className="font-medium text-foreground"
          >
            {review.user?.login ?? "ghost"}
          </ProfileLink>{" "}
          {detail}
        </span>
        {review.submitted_at && (
          <span className="ml-auto text-caption text-[var(--color-fg-faint)]">
            {formatRelativeTime(review.submitted_at)}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg bg-muted",
        "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0.5",
        t.rail,
      )}
    >
      {/* ─── Header (verdict strip) ─────────────────────────────────── */}
      <div
        className={cn(
          "flex items-center gap-2.5 border-b border-border/50 px-4 py-2",
          t.headerTint,
        )}
      >
        <motion.span
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 22, mass: 0.5 }}
          className={cn(
            "inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-background ring-1",
            t.iconRing,
          )}
        >
          <Icon className={cn("size-3", t.iconColor)} strokeWidth={2.5} />
        </motion.span>
        <span
          className={cn(
            "text-caption font-medium uppercase tracking-wider",
            t.iconColor,
            review.state === "DISMISSED" && "italic",
          )}
        >
          {t.label}
        </span>
        <span className="text-caption text-[var(--color-fg-faint)]">·</span>
        <ProfileLink
          login={review.user?.login ?? "ghost"}
          className="text-caption font-medium text-foreground"
        >
          {review.user?.login ?? "ghost"}
        </ProfileLink>
        {review.submitted_at && (
          <>
            <span className="text-caption text-[var(--color-fg-faint)]">·</span>
            <span className="text-caption text-[var(--color-fg-faint)]">
              {formatRelativeTime(review.submitted_at)}
            </span>
          </>
        )}
      </div>

      {/* ─── Body (review prose) ─────────────────────────────────────── */}
      {hasBody && (
        <div className="readme-prose max-w-none px-4 py-3 text-body">
          <GithubMarkdown repoContext={{ owner, repo }}>{review.body!}</GithubMarkdown>
        </div>
      )}

      {/* ─── Inline thread cluster ──────────────────────────────────── */}
      {hasNewThreads && (
        <div className="border-t border-border/50">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={cn(
              "flex w-full items-center gap-2 px-4 py-2 text-caption text-muted-foreground outline-none transition-colors",
              "hover:bg-[var(--color-bg-sunken)]",
              "focus-visible:ring-1 focus-visible:ring-foreground/15",
            )}
          >
            <motion.span
              animate={{ rotate: open ? 90 : 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 26 }}
              className="inline-flex"
            >
              <ChevronRight className="size-3.5" />
            </motion.span>
            <span className="font-medium text-foreground">
              {newThreadCount} {newThreadCount === 1 ? "thread" : "threads"}
            </span>
            <span className="text-[var(--color-fg-faint)]">on</span>
            <span className="font-medium text-foreground">
              {fileGroups.length} {fileGroups.length === 1 ? "file" : "files"}
            </span>
          </button>
          {open && (
            <div className="space-y-4 px-4 pt-1 pb-4">
              {fileGroups.map((g) => (
                <FileSection
                  key={g.path}
                  group={g}
                  owner={owner}
                  repo={repo}
                  number={number}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
