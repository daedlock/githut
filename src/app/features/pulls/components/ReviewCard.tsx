import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronRight,
  EyeOff,
  FileCode,
  MessageSquare,
  Reply,
  RotateCcw,
  Send,
  X,
} from "lucide-react";
import { GithubMarkdown } from "@/app/components/GithubMarkdown";
import { Avatar } from "@/app/components/ui/avatar";
import { Button } from "@/app/components/ui/button";
import { ProfileLink } from "@/app/components/user/ProfileLink";
import { ReactionsBar } from "@/app/features/issues/components/ReactionsBar";
import {
  useMyReviewCommentReactions,
  useReplyToReviewComment,
  useResolveThread,
  useThreadResolution,
  useToggleReviewCommentReaction,
} from "@/app/features/pulls/hooks";
import type { Review, ReviewComment, ReviewState } from "@/app/features/pulls/schemas";
import { EMPTY_MY_REACTIONS, type ReactionContent } from "@/app/features/issues/schemas";
import { reactionsHaveAny } from "@/app/features/issues/utils";
import { useMe } from "@/app/hooks/useMe";
import { cn } from "@/app/lib/cn";
import { formatRelativeTime } from "@/app/lib/time";

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

// ─── Comment bubble ────────────────────────────────────────────────────────

function CommentBubble({
  comment,
  owner,
  repo,
  meId,
  onToggleReaction,
}: {
  comment: ReviewComment;
  owner: string;
  repo: string;
  meId: number | undefined;
  onToggleReaction: (content: ReactionContent, existingId?: number) => void;
}) {
  const myReactionsQuery = useMyReviewCommentReactions(owner, repo, comment.id, meId);
  const myReactions = myReactionsQuery.data ?? EMPTY_MY_REACTIONS;
  const hasReactions = reactionsHaveAny(comment.reactions);

  return (
    <div className="flex gap-2.5">
      <Avatar
        login={comment.user?.login ?? "ghost"}
        avatarUrl={comment.user?.avatar_url}
        size="sm"
        className="mt-0.5 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <ProfileLink
            login={comment.user?.login ?? "ghost"}
            className="text-caption font-medium text-foreground"
          >
            {comment.user?.login ?? "ghost"}
          </ProfileLink>
          <span className="text-caption text-[var(--color-fg-faint)]">
            {formatRelativeTime(comment.created_at)}
          </span>
        </div>
        <div className="mt-0.5 readme-prose max-w-none text-body [overflow-wrap:anywhere]">
          <GithubMarkdown repoContext={{ owner, repo }}>{comment.body}</GithubMarkdown>
        </div>
        {hasReactions && (
          <ReactionsBar
            reactions={comment.reactions}
            myReactions={myReactions}
            onToggle={onToggleReaction}
            className="mt-1.5 border-t-0 pt-0"
          />
        )}
      </div>
    </div>
  );
}

// ─── Reply composer ────────────────────────────────────────────────────────

function ReplyComposer({
  meLogin,
  meAvatarUrl,
  body,
  onChange,
  onSubmit,
  onCancel,
  isPending,
}: {
  meLogin: string;
  meAvatarUrl?: string;
  body: string;
  onChange: (s: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isPending?: boolean;
}) {
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSubmit();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  }
  return (
    <div className="flex gap-2.5">
      <Avatar login={meLogin} avatarUrl={meAvatarUrl} size="sm" className="mt-1 shrink-0" />
      <div className="min-w-0 flex-1">
        <textarea
          value={body}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Reply…"
          rows={2}
          disabled={isPending}
          autoFocus
          className={cn(
            "w-full resize-none rounded-md border border-border bg-background p-2.5 text-body text-foreground",
            "placeholder:text-muted-foreground/60",
            "focus:outline-none focus:ring-1 focus:ring-foreground/15",
          )}
        />
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-caption text-[var(--color-fg-faint)]">⌘↵ to send</span>
          <div className="flex gap-1.5">
            <Button variant="ghost" size="xs" onClick={onCancel} disabled={isPending}>
              Cancel
            </Button>
            <Button size="xs" disabled={!body.trim() || isPending} onClick={onSubmit}>
              <Send data-icon="inline-start" />
              {isPending ? "Sending…" : "Reply"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Thread block — interactive (reply, resolve, reactions) ────────────────

const SPRING_HEIGHT = { type: "spring" as const, stiffness: 380, damping: 32, mass: 0.6 };
const SPRING_POP = { type: "spring" as const, stiffness: 500, damping: 22, mass: 0.5 };

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
  const [replyOpen, setReplyOpen] = useState(false);
  const [body, setBody] = useState("");
  const [expandedAfterResolve, setExpandedAfterResolve] = useState(false);

  const meQuery = useMe();
  const meId = meQuery.data?.id;
  const replyMutation = useReplyToReviewComment(owner, repo, number);
  const toggleReaction = useToggleReviewCommentReaction(owner, repo, number, meId);

  const resolutionQuery = useThreadResolution(owner, repo, number);
  const resolveMutation = useResolveThread(owner, repo, number);
  const threadInfo = resolutionQuery.data?.get(thread.root.id);
  const isResolved = threadInfo?.isResolved ?? false;
  const threadNodeId = threadInfo?.threadNodeId;

  const allComments = [thread.root, ...thread.replies];
  const lastComment = allComments[allComments.length - 1]!;
  const showCollapsed = isResolved && !expandedAfterResolve;

  function handleReply() {
    const text = body.trim();
    if (!text || replyMutation.isPending) return;
    replyMutation.mutate(
      { inReplyToId: thread.root.id, body: text },
      {
        onSuccess: () => {
          setBody("");
          setReplyOpen(false);
        },
      },
    );
  }

  function handleResolveToggle() {
    if (!threadNodeId || resolveMutation.isPending) return;
    resolveMutation.mutate({ threadNodeId, resolve: !isResolved });
  }

  // ── Collapsed resolved strip ─────────────────────────────────────────────
  if (showCollapsed) {
    return (
      <motion.button
        type="button"
        layout
        onClick={() => setExpandedAfterResolve(true)}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={SPRING_POP}
        className={cn(
          "group flex w-full items-center gap-2 rounded-md border border-border/60 bg-background px-3 py-2",
          "text-left outline-none transition-colors",
          "hover:bg-[var(--color-bg-sunken)] focus-visible:ring-1 focus-visible:ring-foreground/15",
        )}
      >
        <motion.span
          className="inline-flex size-4 items-center justify-center"
          whileHover={{ rotate: 90 }}
          transition={SPRING_POP}
        >
          <ChevronRight className="size-3.5 text-[var(--color-fg-faint)] transition-colors group-hover:text-muted-foreground" />
        </motion.span>
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
      </motion.button>
    );
  }

  // ── Full expanded thread ────────────────────────────────────────────────
  return (
    <motion.div
      layout
      transition={SPRING_HEIGHT}
      className={cn(
        "rounded-md border bg-background",
        isResolved
          ? "border-[color-mix(in_oklab,var(--color-success)_30%,var(--color-border))]"
          : "border-border/60",
      )}
    >
      {/* Resolved chip at top */}
      <AnimatePresence initial={false}>
        {isResolved && (
          <motion.div
            key="resolved-chip"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={SPRING_HEIGHT}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-1.5 border-b border-border/60 bg-[color-mix(in_oklab,var(--color-success)_8%,var(--color-bg-subtle))] px-3 py-1.5 text-caption text-[var(--color-success)]">
              <Check className="size-3" strokeWidth={3} />
              <span className="font-medium uppercase tracking-wider">Resolved</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-3 p-3">
        <HunkExcerpt hunk={thread.root.diff_hunk} />

        <div className="space-y-3">
          {allComments.map((c) => (
            <CommentBubble
              key={c.id}
              comment={c}
              owner={owner}
              repo={repo}
              meId={meId}
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
        <AnimatePresence initial={false} mode="wait">
          {replyOpen ? (
            <motion.div
              key="composer"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16 }}
              className="border-t border-border/60 pt-3"
            >
              <ReplyComposer
                meLogin={meQuery.data?.login ?? "ghost"}
                meAvatarUrl={meQuery.data?.avatar_url}
                body={body}
                onChange={setBody}
                onSubmit={handleReply}
                onCancel={() => {
                  setReplyOpen(false);
                  setBody("");
                }}
                isPending={replyMutation.isPending}
              />
            </motion.div>
          ) : (
            <motion.div
              key="actions"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="-mx-1 flex items-center gap-1 border-t border-border/60 pt-2"
            >
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
                  <motion.span
                    key={isResolved ? "unresolve" : "resolve"}
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={SPRING_POP}
                    className="inline-flex"
                    data-icon="inline-start"
                  >
                    {isResolved ? (
                      <RotateCcw className="size-3" />
                    ) : (
                      <Check className="size-3" />
                    )}
                  </motion.span>
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
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
      <motion.div layout className="space-y-2">
        {group.threads.map((t) => (
          <ThreadBlock
            key={t.root.id}
            thread={t}
            owner={owner}
            repo={repo}
            number={number}
          />
        ))}
      </motion.div>
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
  const totalComments = inlineComments.length;
  const hasBody = !!review.body?.trim();
  const hasInline = totalComments > 0;

  const [open, setOpen] = useState(true);

  // Compact strip: empty review (no body, no inline comments).
  if (!hasBody && !hasInline) {
    return (
      <div
        className={cn(
          "relative flex items-center gap-2.5 overflow-hidden rounded-md bg-muted py-1.5 pl-3 pr-3.5",
          "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0.5",
          t.rail,
        )}
      >
        <span className={cn("inline-flex size-4 items-center justify-center", t.iconColor)}>
          <Icon className="size-3.5" strokeWidth={2.5} />
        </span>
        <span className="text-caption text-foreground">
          <ProfileLink
            login={review.user?.login ?? "ghost"}
            className="font-medium text-foreground"
          >
            {review.user?.login ?? "ghost"}
          </ProfileLink>{" "}
          <span
            className={cn(
              review.state === "DISMISSED" && "italic line-through text-[var(--color-fg-faint)]",
            )}
          >
            {t.label.toLowerCase()}
          </span>{" "}
          <span className="text-[var(--color-fg-faint)]">
            without a comment
          </span>
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
      {hasInline && (
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
              {totalComments} {totalComments === 1 ? "comment" : "comments"}
            </span>
            <span className="text-[var(--color-fg-faint)]">on</span>
            <span className="font-medium text-foreground">
              {fileGroups.length} {fileGroups.length === 1 ? "file" : "files"}
            </span>
          </button>
          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                key="threads"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{
                  height: { type: "spring", stiffness: 400, damping: 30, mass: 0.6 },
                  opacity: { duration: 0.12 },
                }}
                className="overflow-hidden"
              >
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
