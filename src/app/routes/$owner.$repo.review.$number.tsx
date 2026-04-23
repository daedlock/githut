import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Send } from "lucide-react";
import { useState } from "react";
import {
  buildSources,
  codeTokensQueryOptions,
  DiffLayout,
  type DiffLayoutFile,
  type DiffReviewHooks,
  type FileStatus,
  parseUnifiedDiff,
} from "@/app/components/code";
import { Button } from "@/app/components/ui/button";
import { Skeleton } from "@/app/components/ui/skeleton";
import { InlineComposer } from "@/app/features/pulls/components/InlineComposer";
import { InlineThread } from "@/app/features/pulls/components/InlineThread";
import { PrReviewDialog } from "@/app/features/pulls/components/PrReviewDialog";
import { PrStatePill } from "@/app/features/pulls/components/PrStatePill";
import {
  prDetailQueryOptions,
  prFilesQueryOptions,
  prReviewCommentsQueryOptions,
  useFullPr,
  usePrFiles,
  usePrReviewComments,
} from "@/app/features/pulls/hooks";
import { toUiState } from "@/app/features/pulls/lib/prStatus";
import type { PrFile, ReviewComment } from "@/app/features/pulls/schemas";
import {
  usePendingComments,
  useReviewMode,
  useReviewStore,
  type PendingComment,
} from "@/app/features/pulls/stores/review";
import { useMe } from "@/app/hooks/useMe";
import { detectLang } from "@/app/lib/detectLang";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

// ─── Full-width PR review route ────────────────────────────────────────────
//
// Dedicated review workspace — takes over the full viewport. No PR header
// or sub-tabs; just a slim context bar + the diff layout. Mirrors DiffKit's
// approach: clean, focused, zero wasted space.

export const Route = createFileRoute("/$owner/$repo/review/$number")({
  parseParams: (raw) => ({ number: Number(raw.number) }),
  loader: ({ context, params }) => {
    const { owner, repo, number } = params;
    if (!Number.isFinite(number)) return;
    const qc = context.queryClient;
    void qc.prefetchQuery(prDetailQueryOptions(owner, repo, number));
    void qc.prefetchQuery(prFilesQueryOptions(owner, repo, number));
    void qc.prefetchQuery(prReviewCommentsQueryOptions(owner, repo, number));
  },
  component: ReviewPage,
});

function ReviewPage() {
  const { owner, repo, number } = Route.useParams();
  const prQuery = useFullPr(owner, repo, number);
  const filesQuery = usePrFiles(owner, repo, number);
  const meQuery = useMe();
  const qc = useQueryClient();

  const reviewMode = useReviewMode(owner, repo, number);
  const pending = usePendingComments(owner, repo, number);
  const store = useReviewStore();

  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);

  const pr = prQuery.data;
  const isAuthor = pr?.user?.login === meQuery.data?.login;
  const canReview = !!pr && pr.state === "open" && !pr.merged;
  const uiState = pr ? toUiState(pr) : null;

  const diffFiles = useMemo<DiffLayoutFile[]>(
    () => (filesQuery.data ?? []).map(toDiffLayoutFile),
    [filesQuery.data],
  );

  // Prefetch Shiki tokens for all files
  useEffect(() => {
    const files = filesQuery.data;
    if (!files) return;
    for (const f of files) {
      if (!f.patch) continue;
      const lang = detectLang(f.filename);
      const hunks = parseUnifiedDiff(f.patch);
      if (hunks.length === 0) continue;
      const { oldSource, newSource } = buildSources(hunks);
      void qc.prefetchQuery(codeTokensQueryOptions(oldSource, lang));
      void qc.prefetchQuery(codeTokensQueryOptions(newSource, lang));
    }
  }, [filesQuery.data, qc]);

  // Review hooks (same stable-ref pattern as PrFilesPage)
  const reviewCommentsQuery = usePrReviewComments(owner, repo, number);
  const threadLineKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const c of reviewCommentsQuery.data ?? []) {
      if (c.in_reply_to_id) continue;
      keys.add(`${c.path}:${c.side ?? "RIGHT"}:${c.line ?? c.original_line ?? 0}`);
    }
    return keys;
  }, [reviewCommentsQuery.data]);

  const threadKeysRef = useRef(threadLineKeys);
  threadKeysRef.current = threadLineKeys;
  const composerRef = useRef(store.composerByPr);
  composerRef.current = useReviewStore.getState().composerByPr;
  const pendingRef = useRef(store.pendingByPr);
  pendingRef.current = useReviewStore.getState().pendingByPr;
  const prKey = `${owner}/${repo}/${number}`;

  const hooksCache = useRef(new Map<string, DiffReviewHooks>());

  const getReviewHooks = useCallback(
    (filename: string): DiffReviewHooks | undefined => {
      if (!canReview) return undefined;
      let hooks = hooksCache.current.get(filename);
      if (!hooks) {
        hooks = {
          onAddComment: (args) => {
            if (!reviewMode) store.startReview(owner, repo, number);
            store.openComposer(owner, repo, number, { path: filename, ...args });
          },
          renderLineTrailer: (args) => {
            const key = `${filename}:${args.side}:${args.line}`;
            const hasThread = threadKeysRef.current.has(key);
            const composer = composerRef.current[prKey];
            const isComposer = !!composer && composer.path === filename && composer.side === args.side && composer.line === args.line;
            const pendingList = pendingRef.current[prKey];
            const hasPending = !!pendingList && pendingList.some(c => c.path === filename && c.side === args.side && c.line === args.line);
            if (!hasThread && !isComposer && !hasPending) return null;
            return (
              <LineSlot owner={owner} repo={repo} number={number} path={filename} side={args.side} line={args.line} />
            );
          },
        };
        hooksCache.current.set(filename, hooks);
      }
      return hooks;
    },
    [canReview, reviewMode, owner, repo, number, store, prKey],
  );

  // Auto-start review mode on this page
  useEffect(() => {
    if (canReview && !reviewMode) store.startReview(owner, repo, number);
  }, [canReview, reviewMode, owner, repo, number, store]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Compact review header — full width */}
      <div className="sticky top-0 z-40 flex h-10 min-h-10 shrink-0 items-center gap-3 border-b border-border bg-background px-3 sm:px-4">
        {/* Back */}
        <Link
          to="/$owner/$repo/pulls/$number"
          params={{ owner, repo, number }}
          className="inline-flex items-center gap-1.5 text-caption text-muted-foreground outline-none transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          <span className="hidden sm:inline">Back to PR</span>
        </Link>

        {/* PR context */}
        {pr && (
          <div className="flex items-center gap-2 min-w-0">
            <PrStatePill state={uiState!} size="xs" />
            <span className="truncate font-mono text-caption text-foreground">
              {pr.title}
              <span className="ml-1 text-[var(--color-fg-faint)]">#{number}</span>
            </span>
          </div>
        )}

        <div className="flex-1" />

        {/* Stats */}
        {pr && (
          <span className="hidden items-center gap-2 text-caption tabular-nums sm:flex">
            <span className="text-muted-foreground">{pr.changed_files} files</span>
            <span className="text-[var(--color-success)]">+{pr.additions}</span>
            <span className="text-[var(--color-danger)]">−{pr.deletions}</span>
          </span>
        )}

        {/* Review actions */}
        {canReview && (
          <div className="flex items-center gap-2">
            {pending.length > 0 && (
              <span className="text-micro tabular-nums text-muted-foreground">
                <span className="font-medium text-foreground">{pending.length}</span> pending
              </span>
            )}
            {reviewMode && (
              <Button
                size="xs"
                variant="ghost"
                onClick={() => store.cancelReview(owner, repo, number)}
              >
                Cancel
              </Button>
            )}
            <Button
              size="xs"
              onClick={() => setReviewDialogOpen(true)}
            >
              <Send data-icon="inline-start" />
              Submit review
            </Button>
          </div>
        )}
      </div>

      {/* Full-width diff */}
      <div className="flex-1">
        {filesQuery.isPending ? (
          <ReviewSkeleton />
        ) : filesQuery.isError ? (
          <div className="flex items-center justify-center py-20 text-body text-muted-foreground">
            Could not load files for this pull request.
          </div>
        ) : (
          <DiffLayout
            files={diffFiles}
            initialSidebarOpen={diffFiles.length > 1}
            getReviewHooks={getReviewHooks}
          />
        )}
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

// ─── Reuse LineSlot from PrFilesPage (same pattern) ─────────────────────────

const LineSlot = memo(function LineSlot(props: {
  owner: string; repo: string; number: number;
  path: string; side: "LEFT" | "RIGHT"; line: number;
}) {
  const { owner, repo, number, path, side, line } = props;
  const prKey = `${owner}/${repo}/${number}`;
  const store = useReviewStore();

  const isComposerHere = useReviewStore(s => {
    const c = s.composerByPr[prKey];
    return !!c && c.path === path && c.side === side && c.line === line;
  });
  const hasPending = useReviewStore(s => {
    const list = s.pendingByPr[prKey];
    return !!list && list.some(c => c.path === path && c.side === side && c.line === line);
  });
  const reviewCommentsQuery = usePrReviewComments(owner, repo, number);
  const hasThreads = useMemo(() => {
    const comments = reviewCommentsQuery.data;
    if (!comments?.length) return false;
    return comments.some(c => {
      const cSide = c.side ?? "RIGHT";
      const cLine = c.line ?? c.original_line ?? 0;
      return c.path === path && cSide === side && cLine === line && !c.in_reply_to_id;
    });
  }, [reviewCommentsQuery.data, path, side, line]);

  if (!isComposerHere && !hasPending && !hasThreads) return null;
  return <LineSlotContent {...props} />;
});

const LineSlotContent = memo(function LineSlotContent({
  owner, repo, number, path, side, line,
}: { owner: string; repo: string; number: number; path: string; side: "LEFT" | "RIGHT"; line: number }) {
  const store = useReviewStore();
  const prKey = `${owner}/${repo}/${number}`;

  const isComposerHere = useReviewStore(s => {
    const c = s.composerByPr[prKey];
    return !!c && c.path === path && c.side === side && c.line === line;
  });
  const allPendingForPr = useReviewStore(s => s.pendingByPr[prKey]);
  const pendingHere = useMemo(
    () => (allPendingForPr ?? []).filter(c => c.path === path && c.side === side && c.line === line),
    [allPendingForPr, path, side, line],
  );
  const reviewCommentsQuery = usePrReviewComments(owner, repo, number);
  const threads = useMemo(() => {
    const comments = reviewCommentsQuery.data ?? [];
    return buildThreadsForLine(comments, path, side, line);
  }, [reviewCommentsQuery.data, path, side, line]);

  return (
    <>
      {threads.map(t => (
        <InlineThread key={t.root.id} owner={owner} repo={repo} number={number} root={t.root} replies={t.replies} />
      ))}
      {pendingHere.map(c => (
        <PendingCard key={c.id} comment={c} onRemove={() => store.removePending(owner, repo, number, c.id)} />
      ))}
      {isComposerHere && (
        <InlineComposer
          onSubmit={(body: string) => { store.addPending(owner, repo, number, { path, side, line, body }); store.closeComposer(owner, repo, number); }}
          onCancel={() => store.closeComposer(owner, repo, number)}
          submitLabel="Add review comment"
        />
      )}
    </>
  );
});

function PendingCard({ comment, onRemove }: { comment: PendingComment; onRemove: () => void }) {
  return (
    <div className="sticky left-0 mx-4 my-2 max-w-[calc(100cqi-3rem)] overflow-hidden rounded-md border border-dashed border-primary/40 bg-[var(--color-bg-sunken)] px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <span className="text-micro font-medium text-primary">Pending</span>
          <p className="mt-0.5 font-mono text-caption text-foreground whitespace-pre-wrap">{comment.body}</p>
        </div>
        <button type="button" onClick={onRemove} className="shrink-0 text-caption text-muted-foreground hover:text-destructive">Remove</button>
      </div>
    </div>
  );
}

type Thread = { root: ReviewComment; replies: ReviewComment[] };

function buildThreadsForLine(comments: ReviewComment[], path: string, side: "LEFT" | "RIGHT", line: number): Thread[] {
  const byId = new Map<number, ReviewComment>();
  for (const c of comments) byId.set(c.id, c);
  const threads = new Map<number, Thread>();
  for (const c of comments) {
    const rootId = findRootId(c, byId);
    let t = threads.get(rootId);
    if (!t) { t = { root: byId.get(rootId) ?? c, replies: [] }; threads.set(rootId, t); }
    if (c.id !== rootId) t.replies.push(c);
  }
  const result: Thread[] = [];
  for (const t of threads.values()) {
    if (t.root.path === path && (t.root.side ?? "RIGHT") === side && (t.root.line ?? t.root.original_line ?? 0) === line) {
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
    case "added": case "removed": case "modified": case "renamed": case "copied": return status;
    default: return "modified";
  }
}

function ReviewSkeleton() {
  return (
    <div className="p-6">
      <div className="skeleton-fade flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        {[80, 60, 72].map(w => (
          <div key={w} className="rounded-md border border-border p-3">
            <Skeleton className="h-4 mb-2" style={{ width: `${w}%` }} />
            <Skeleton className="h-3 w-5/6" />
          </div>
        ))}
      </div>
    </div>
  );
}
