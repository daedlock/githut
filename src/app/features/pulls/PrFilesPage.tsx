import { AlertCircle, FileDiff as FileDiffIcon, MessageSquarePlus, Send } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
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
  useActiveComposer,
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

  // Stable factory — returns a fixed DiffReviewHooks per filename.
  // LineSlot subscribes to its own state independently, so this factory
  // never needs to change. The "+" handler writes to the zustand store.
  const getReviewHooks = useCallback(
    (filename: string): DiffReviewHooks | undefined => {
      if (!canReview) return undefined;
      return {
        onAddComment: (args) => {
          store.openComposer(owner, repo, number, {
            path: filename,
            ...args,
          });
        },
        renderLineTrailer: (args) => (
          <LineSlot
            owner={owner}
            repo={repo}
            number={number}
            path={filename}
            side={args.side}
            line={args.line}
          />
        ),
      };
    },
    [canReview, owner, repo, number, store],
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
// Each slot subscribes independently to:
//   • Zustand — active composer + pending comments for this line
//   • TanStack Query — review comments (via usePrReviewComments cache)
// Only the slot whose data changed re-renders. The parent diff tree stays
// frozen → no lag when opening a composer.

const LineSlot = memo(function LineSlot({
  owner,
  repo,
  number,
  path,
  side,
  line,
}: {
  owner: string;
  repo: string;
  number: number;
  path: string;
  side: "LEFT" | "RIGHT";
  line: number;
}) {
  const store = useReviewStore();
  const activeComposer = useActiveComposer(owner, repo, number);
  const allPending = usePendingComments(owner, repo, number);
  const reviewCommentsQuery = usePrReviewComments(owner, repo, number);

  const isComposerHere =
    activeComposer?.path === path &&
    activeComposer.side === side &&
    activeComposer.line === line;

  const pendingHere = useMemo(
    () => allPending.filter((c) => c.path === path && c.side === side && c.line === line),
    [allPending, path, side, line],
  );

  const threads = useMemo(() => {
    const comments = reviewCommentsQuery.data ?? [];
    return buildThreadsForLine(comments, path, side, line);
  }, [reviewCommentsQuery.data, path, side, line]);

  if (!threads.length && !pendingHere.length && !isComposerHere) return null;

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
