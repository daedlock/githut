import { AlertCircle, FileDiff as FileDiffIcon, MessageSquarePlus, Send } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import {
  DiffLayout,
  type DiffLayoutFile,
  type DiffReviewHooks,
  type FileStatus,
} from "@/app/components/code";
import { Button } from "@/app/components/ui/button";
import { Skeleton } from "@/app/components/ui/skeleton";
import { InlineComposer } from "@/app/features/pulls/components/InlineComposer";
import { InlineThread } from "@/app/features/pulls/components/InlineThread";
import { PrReviewDialog } from "@/app/features/pulls/components/PrReviewDialog";
import {
  useFullPr,
  usePrFiles,
  usePrReviewComments,
} from "@/app/features/pulls/hooks";
import type { PrFile, ReviewComment } from "@/app/features/pulls/schemas";
import {
  usePendingComments,
  useReviewMode,
  useReviewStore,
  type PendingComment,
  type PendingSide,
} from "@/app/features/pulls/stores/review";
import { useMe } from "@/app/hooks/useMe";
import { detectLang } from "@/app/lib/detectLang";

// ─── PrFilesPage ───────────────────────────────────────────────────────────
//
// Full review workspace. When review mode is off the diff is read-only;
// clicking "Start review" arms line-level comment affordances throughout
// the diff. Pending comments accumulate in the Zustand review store and
// are submitted as a batch with the "Finish review" dialog.
//
// Existing review threads from prior reviews render inline at the
// relevant line. Replies are supported via the InlineThread component.

export type PrFilesPageProps = {
  owner: string;
  repo: string;
  number: number;
};

export function PrFilesPage({ owner, repo, number }: PrFilesPageProps) {
  const filesQuery = usePrFiles(owner, repo, number);
  const prQuery = useFullPr(owner, repo, number);
  const reviewCommentsQuery = usePrReviewComments(owner, repo, number);
  const meQuery = useMe();

  const reviewMode = useReviewMode(owner, repo, number);
  const pending = usePendingComments(owner, repo, number);
  const store = useReviewStore();

  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [activeComposer, setActiveComposer] = useState<{
    path: string;
    side: PendingSide;
    line: number;
  } | null>(null);

  // ── Derived ───────────────────────────────────────────────────────────
  const canReview =
    !!prQuery.data && prQuery.data.state === "open" && !prQuery.data.merged;
  const isAuthor = prQuery.data?.user?.login === meQuery.data?.login;

  const diffFiles = useMemo<DiffLayoutFile[]>(
    () => (filesQuery.data ?? []).map(toDiffLayoutFile),
    [filesQuery.data],
  );

  // Group existing review comments by `path:side:line` for O(1) lookup.
  const threadMap = useMemo(() => {
    const comments = reviewCommentsQuery.data ?? [];
    return buildThreadMap(comments);
  }, [reviewCommentsQuery.data]);

  // Group pending comments by same key.
  const pendingMap = useMemo(() => {
    const m = new Map<string, PendingComment[]>();
    for (const c of pending) {
      const k = `${c.path}:${c.side}:${c.line}`;
      const arr = m.get(k) ?? [];
      arr.push(c);
      m.set(k, arr);
    }
    return m;
  }, [pending]);

  // ── Review hooks factory — one per file ───────────────────────────────
  const getReviewHooks = useCallback(
    (filename: string): DiffReviewHooks | undefined => {
      if (!canReview) return undefined;
      return {
        onAddComment: reviewMode
          ? (args) => {
              setActiveComposer({ path: filename, ...args });
            }
          : undefined,
        renderLineTrailer: (args) => {
          const key = `${filename}:${args.side}:${args.line}`;
          const threads = threadMap.get(key);
          const pendingHere = pendingMap.get(key);
          const isComposerHere =
            activeComposer?.path === filename &&
            activeComposer.side === args.side &&
            activeComposer.line === args.line;
          if (!threads?.length && !pendingHere?.length && !isComposerHere)
            return null;
          return (
            <LineTrailer
              owner={owner}
              repo={repo}
              number={number}
              threads={threads}
              pending={pendingHere}
              isComposerHere={isComposerHere}
              onSaveComment={(body) => {
                store.addPending(owner, repo, number, {
                  path: filename,
                  side: args.side,
                  line: args.line,
                  body,
                });
                setActiveComposer(null);
              }}
              onCancelComposer={() => setActiveComposer(null)}
              onRemovePending={(id) =>
                store.removePending(owner, repo, number, id)
              }
            />
          );
        },
      };
    },
    [
      canReview,
      reviewMode,
      threadMap,
      pendingMap,
      activeComposer,
      owner,
      repo,
      number,
      store,
    ],
  );

  // ── Render ────────────────────────────────────────────────────────────
  if (filesQuery.isPending) return <PrFilesSkeleton />;
  if (filesQuery.isError) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <AlertCircle className="size-5 text-destructive" />
        <p className="text-body text-muted-foreground">
          Could not load the diff for this pull request.
        </p>
      </div>
    );
  }
  if (diffFiles.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <FileDiffIcon className="size-5 text-[var(--color-fg-faint)]" />
        <p className="text-body text-muted-foreground">No file changes.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0">
      {/* Review action bar */}
      {canReview && (
        <div className="sticky top-0 z-20 flex items-center justify-end gap-2 border-b border-border bg-background/95 px-3 py-2 backdrop-blur-sm">
          {!reviewMode ? (
            <Button
              size="sm"
              onClick={() => store.startReview(owner, repo, number)}
            >
              <MessageSquarePlus data-icon="inline-start" />
              Start review
            </Button>
          ) : (
            <>
              {pending.length > 0 && (
                <span className="text-caption text-muted-foreground">
                  <span className="tabular-nums font-medium text-foreground">
                    {pending.length}
                  </span>{" "}
                  pending {pending.length === 1 ? "comment" : "comments"}
                </span>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => store.cancelReview(owner, repo, number)}
              >
                Cancel review
              </Button>
              <Button
                size="sm"
                onClick={() => setReviewDialogOpen(true)}
              >
                <Send data-icon="inline-start" />
                Finish review
              </Button>
            </>
          )}
        </div>
      )}

      {/* Diff */}
      <div className="-mx-4 sm:-mx-6">
        <DiffLayout
          files={diffFiles}
          initialSidebarOpen={diffFiles.length > 1}
          getReviewHooks={getReviewHooks}
        />
      </div>

      <PrReviewDialog
        open={reviewDialogOpen}
        onOpenChange={setReviewDialogOpen}
        owner={owner}
        repo={repo}
        number={number}
        isAuthor={isAuthor}
        pendingComments={pending}
        onReviewSubmitted={() => {
          store.cancelReview(owner, repo, number);
          setReviewDialogOpen(false);
        }}
      />
    </div>
  );
}

// ─── LineTrailer ────────────────────────────────────────────────────────────
//
// Renders below a diff row when threads, pending comments, or the active
// composer belong to that line. Kept intentionally lightweight — no
// CommentBox, no markdown-preview, just native textarea.

type Thread = { root: ReviewComment; replies: ReviewComment[] };

function LineTrailer({
  owner,
  repo,
  number,
  threads,
  pending: pendingHere,
  isComposerHere,
  onSaveComment,
  onCancelComposer,
  onRemovePending,
}: {
  owner: string;
  repo: string;
  number: number;
  threads?: Thread[];
  pending?: PendingComment[];
  isComposerHere: boolean;
  onSaveComment: (body: string) => void;
  onCancelComposer: () => void;
  onRemovePending: (id: number) => void;
}) {
  return (
    <>
      {threads?.map((t) => (
        <InlineThread
          key={t.root.id}
          owner={owner}
          repo={repo}
          number={number}
          root={t.root}
          replies={t.replies}
        />
      ))}
      {pendingHere?.map((c) => (
        <PendingCard key={c.id} comment={c} onRemove={() => onRemovePending(c.id)} />
      ))}
      {isComposerHere && (
        <InlineComposer
          onSubmit={onSaveComment}
          onCancel={onCancelComposer}
          submitLabel="Add review comment"
        />
      )}
    </>
  );
}

function PendingCard({
  comment,
  onRemove,
}: {
  comment: PendingComment;
  onRemove: () => void;
}) {
  return (
    <div className="mx-4 my-2 overflow-hidden rounded-md border border-dashed border-primary/40 bg-[var(--color-bg-sunken)] px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <span className="text-micro font-medium text-primary">Pending review comment</span>
          <p className="mt-0.5 font-mono text-caption text-foreground whitespace-pre-wrap">
            {comment.body}
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 text-caption text-muted-foreground hover:text-destructive"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

// ─── Thread grouping ───────────────────────────────────────────────────────

function buildThreadMap(comments: ReviewComment[]) {
  const byId = new Map<number, ReviewComment>();
  for (const c of comments) byId.set(c.id, c);

  const threads = new Map<number, Thread>();
  for (const c of comments) {
    const rootId = findRootId(c, byId);
    let t = threads.get(rootId);
    if (!t) {
      const root = byId.get(rootId) ?? c;
      t = { root, replies: [] };
      threads.set(rootId, t);
    }
    if (c.id !== rootId) t.replies.push(c);
  }
  for (const t of threads.values()) {
    t.replies.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  }

  const map = new Map<string, Thread[]>();
  for (const t of threads.values()) {
    const side = t.root.side ?? "RIGHT";
    const line = t.root.line ?? t.root.original_line ?? 0;
    const key = `${t.root.path}:${side}:${line}`;
    const arr = map.get(key) ?? [];
    arr.push(t);
    map.set(key, arr);
  }
  return map;
}

function findRootId(c: ReviewComment, byId: Map<number, ReviewComment>): number {
  let current = c;
  const seen = new Set<number>();
  while (current.in_reply_to_id && !seen.has(current.id)) {
    seen.add(current.id);
    const next = byId.get(current.in_reply_to_id);
    if (!next) break;
    current = next;
  }
  return current.id;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function toDiffLayoutFile(f: PrFile): DiffLayoutFile {
  return {
    filename: f.filename,
    previousFilename: f.previous_filename,
    status: normalizeStatus(f.status),
    additions: f.additions,
    deletions: f.deletions,
    patch: f.patch ?? null,
    lang: detectLang(f.filename),
  };
}

function normalizeStatus(status: PrFile["status"]): FileStatus {
  switch (status) {
    case "added":
    case "removed":
    case "modified":
    case "renamed":
    case "copied":
      return status;
    default:
      return "modified";
  }
}

function PrFilesSkeleton() {
  return (
    <div className="skeleton-fade flex flex-col gap-3">
      <div className="flex items-center gap-3 border-b border-border pb-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-20" />
      </div>
      {[80, 64, 72, 50].map((w) => (
        <div key={w} className="rounded-md border border-border p-3">
          <Skeleton className="h-4 mb-2" style={{ width: `${w}%` }} />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-4/6 mt-1" />
        </div>
      ))}
    </div>
  );
}
