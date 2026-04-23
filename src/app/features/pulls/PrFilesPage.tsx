import { AlertCircle, FileDiff as FileDiffIcon, MessageSquarePlus, Send } from "lucide-react";
import { memo, useCallback, useMemo, useRef, useState } from "react";
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
} from "@/app/features/pulls/stores/review";
import { useMe } from "@/app/hooks/useMe";
import { detectLang } from "@/app/lib/detectLang";

// ─── PrFilesPage ───────────────────────────────────────────────────────────

export type PrFilesPageProps = {
  owner: string;
  repo: string;
  number: number;
};

export function PrFilesPage({ owner, repo, number }: PrFilesPageProps) {
  const filesQuery = usePrFiles(owner, repo, number);
  const prQuery = useFullPr(owner, repo, number);

  const reviewMode = useReviewMode(owner, repo, number);
  const pending = usePendingComments(owner, repo, number);
  const store = useReviewStore();

  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);

  const canReview =
    !!prQuery.data && prQuery.data.state === "open" && !prQuery.data.merged;
  const isAuthor = prQuery.data?.user?.login === useMe().data?.login;

  const diffFiles = useMemo<DiffLayoutFile[]>(
    () => (filesQuery.data ?? []).map(toDiffLayoutFile),
    [filesQuery.data],
  );

  // Build a set of line keys that have existing review threads. This is
  // cheap (one pass over the review comments array, which rarely exceeds
  // ~100 items) and lets renderLineTrailer skip mounting a component for
  // the 99% of lines that have no content.
  const reviewCommentsQuery = usePrReviewComments(owner, repo, number);
  const threadLineKeys = useMemo(() => {
    const keys = new Set<string>();
    const comments = reviewCommentsQuery.data ?? [];
    for (const c of comments) {
      if (c.in_reply_to_id) continue;
      const s = c.side ?? "RIGHT";
      const l = c.line ?? c.original_line ?? 0;
      keys.add(`${c.path}:${s}:${l}`);
    }
    return keys;
  }, [reviewCommentsQuery.data]);

  // Refs for state the factory reads but shouldn't depend on for identity.
  const threadKeysRef = useRef(threadLineKeys);
  threadKeysRef.current = threadLineKeys;
  const composerRef = useRef<ReturnType<typeof useReviewStore.getState>["composerByPr"]>({});
  composerRef.current = useReviewStore.getState().composerByPr;
  const pendingRef = useRef<ReturnType<typeof useReviewStore.getState>["pendingByPr"]>({});
  pendingRef.current = useReviewStore.getState().pendingByPr;

  const prKey = `${owner}/${repo}/${number}`;

  // Per-file hooks are cached in a ref so DiffLayout/FileDiff/DiffView
  // receive stable object references across re-renders.
  const hooksCache = useRef(new Map<string, DiffReviewHooks>());
  const prevCanReview = useRef(canReview);
  if (prevCanReview.current !== canReview) {
    hooksCache.current.clear();
    prevCanReview.current = canReview;
  }

  const getReviewHooks = useCallback(
    (filename: string): DiffReviewHooks | undefined => {
      if (!canReview) return undefined;
      let hooks = hooksCache.current.get(filename);
      if (!hooks) {
        hooks = {
          onAddComment: (args) => {
            store.openComposer(owner, repo, number, {
              path: filename,
              ...args,
            });
          },
          renderLineTrailer: (args) => {
            const key = `${filename}:${args.side}:${args.line}`;
            // Fast path: skip mounting a component for lines with no content.
            // Check thread set + composer + pending via refs (not hooks —
            // this runs during the parent render, not in a component).
            const hasThread = threadKeysRef.current.has(key);
            const composer = composerRef.current[prKey];
            const isComposer =
              !!composer &&
              composer.path === filename &&
              composer.side === args.side &&
              composer.line === args.line;
            const pendingList = pendingRef.current[prKey];
            const hasPending =
              !!pendingList &&
              pendingList.some(
                (c) =>
                  c.path === filename &&
                  c.side === args.side &&
                  c.line === args.line,
              );
            if (!hasThread && !isComposer && !hasPending) return null;
            return (
              <LineSlot
                owner={owner}
                repo={repo}
                number={number}
                path={filename}
                side={args.side}
                line={args.line}
              />
            );
          },
        };
        hooksCache.current.set(filename, hooks);
      }
      return hooks;
    },
    [canReview, owner, repo, number, store, prKey],
  );

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
              <Button size="sm" onClick={() => setReviewDialogOpen(true)}>
                <Send data-icon="inline-start" />
                Finish review
              </Button>
            </>
          )}
        </div>
      )}

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

// ─── LineSlot ──────────────────────────────────────────────────────────────
//
// Gate component: uses primitive-boolean Zustand selectors so Zustand's
// Object.is equality skips re-renders for 99% of slots (false === false).
// Only slots whose data actually changed re-render. The full content
// component (LineSlotContent) mounts lazily — most slots render null.

type LineSlotProps = {
  owner: string;
  repo: string;
  number: number;
  path: string;
  side: "LEFT" | "RIGHT";
  line: number;
};

const LineSlot = memo(function LineSlot(props: LineSlotProps) {
  const { owner, repo, number, path, side, line } = props;
  const prKey = `${owner}/${repo}/${number}`;

  // Primitive selectors — Object.is equality means false===false → no re-render
  const isComposerHere = useReviewStore(
    (s) => {
      const c = s.composerByPr[prKey];
      return !!c && c.path === path && c.side === side && c.line === line;
    },
  );

  const hasPending = useReviewStore(
    (s) => {
      const list = s.pendingByPr[prKey];
      return !!list && list.some((c) => c.path === path && c.side === side && c.line === line);
    },
  );

  // Thread check — review comments change rarely (only on review submit)
  const reviewCommentsQuery = usePrReviewComments(owner, repo, number);
  const hasThreads = useMemo(() => {
    const comments = reviewCommentsQuery.data;
    if (!comments?.length) return false;
    return comments.some((c) => {
      const cSide = c.side ?? "RIGHT";
      const cLine = c.line ?? c.original_line ?? 0;
      return c.path === path && cSide === side && cLine === line && !c.in_reply_to_id;
    });
  }, [reviewCommentsQuery.data, path, side, line]);

  if (!isComposerHere && !hasPending && !hasThreads) return null;

  return <LineSlotContent {...props} />;
});

const LineSlotContent = memo(function LineSlotContent({
  owner,
  repo,
  number,
  path,
  side,
  line,
}: LineSlotProps) {
  const store = useReviewStore();
  const prKey = `${owner}/${repo}/${number}`;

  const isComposerHere = useReviewStore(
    (s) => {
      const c = s.composerByPr[prKey];
      return !!c && c.path === path && c.side === side && c.line === line;
    },
  );

  const allPendingForPr = useReviewStore((s) => s.pendingByPr[prKey]);
  const pendingHere = useMemo(
    () => (allPendingForPr ?? []).filter((c) => c.path === path && c.side === side && c.line === line),
    [allPendingForPr, path, side, line],
  );

  const reviewCommentsQuery = usePrReviewComments(owner, repo, number);
  const threads = useMemo(() => {
    const comments = reviewCommentsQuery.data ?? [];
    return buildThreadsForLine(comments, path, side, line);
  }, [reviewCommentsQuery.data, path, side, line]);

  return (
    <>
      {threads.map((t) => (
        <InlineThread
          key={t.root.id}
          owner={owner}
          repo={repo}
          number={number}
          root={t.root}
          replies={t.replies}
        />
      ))}
      {pendingHere.map((c) => (
        <PendingCard
          key={c.id}
          comment={c}
          onRemove={() => store.removePending(owner, repo, number, c.id)}
        />
      ))}
      {isComposerHere && (
        <InlineComposer
          onSubmit={(body) => {
            store.addPending(owner, repo, number, { path, side, line, body });
            store.closeComposer(owner, repo, number);
          }}
          onCancel={() => store.closeComposer(owner, repo, number)}
          submitLabel="Add review comment"
        />
      )}
    </>
  );
});

function PendingCard({
  comment,
  onRemove,
}: {
  comment: PendingComment;
  onRemove: () => void;
}) {
  return (
    <div className="sticky left-0 mx-4 my-2 max-w-[calc(100cqi-3rem)] overflow-hidden rounded-md border border-dashed border-primary/40 bg-[var(--color-bg-sunken)] px-3 py-2">
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

// ─── Thread grouping for a specific line ───────────────────────────────────

type Thread = { root: ReviewComment; replies: ReviewComment[] };

function buildThreadsForLine(
  comments: ReviewComment[],
  path: string,
  side: "LEFT" | "RIGHT",
  line: number,
): Thread[] {
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

  const result: Thread[] = [];
  for (const t of threads.values()) {
    const rSide = t.root.side ?? "RIGHT";
    const rLine = t.root.line ?? t.root.original_line ?? 0;
    if (t.root.path === path && rSide === side && rLine === line) {
      t.replies.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
      result.push(t);
    }
  }
  return result;
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
