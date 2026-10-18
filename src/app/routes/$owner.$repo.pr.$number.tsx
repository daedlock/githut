import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ChevronDown, ChevronUp, MessageSquare } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildSources,
  ChangeStatsBadge,
  codeTokenChunksQueryOptions,
  DiffLayout,
  type DiffLayoutFile,
  type DiffReviewHooks,
  type FileStatus,
  parseUnifiedDiff,
} from "@/app/components/code";
import { DiffLayoutSkeleton } from "@/app/components/code/DiffLayoutSkeleton";
import { Button } from "@/app/components/ui/button";
import { Container } from "@/app/components/ui/Container";
import { InlineComposer } from "@/app/features/pulls/components/InlineComposer";
import { InlineThread } from "@/app/features/pulls/components/InlineThread";
import { PrReviewPopover } from "@/app/features/pulls/components/PrReviewDialog";
import { PrStatePill } from "@/app/features/pulls/components/PrStatePill";
import {
  prDetailQueryOptions,
  prFilesQueryOptions,
  prReviewCommentsQueryOptions,
  useFullPr,
  usePrFiles,
  usePrReviewComments,
} from "@/app/features/pulls/hooks";
import type { PrUiState } from "@/app/features/pulls/lib/prStatus";
import { toUiState } from "@/app/features/pulls/lib/prStatus";
import type { PrFile, PullRequest, ReviewComment } from "@/app/features/pulls/schemas";
import {
  type PendingComment,
  usePendingComments,
  useReviewHasDraft,
  useReviewMode,
  useReviewStore,
} from "@/app/features/pulls/stores/review";
import { useMe } from "@/app/hooks/useMe";
import { detectLang } from "@/app/lib/detectLang";
import { draftKey, draftPage, hasDraft, useDraftsStore } from "@/app/stores/drafts";

// ─── PR review route ──────────────────────────────────────────────────────
//
// Dedicated review workspace — follows the saved container width. No PR header
// or sub-tabs; just a slim context bar + the diff layout. Mirrors DiffKit's
// approach: clean, focused, zero wasted space.

export const Route = createFileRoute("/$owner/$repo/pr/$number")({
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

  const pr = prQuery.data;
  const canReview = !!pr && pr.state === "open" && !pr.merged;
  const uiState = pr ? toUiState(pr) : null;

  const diffFiles = useMemo<DiffLayoutFile[]>(
    () => (filesQuery.data ?? []).map(toDiffLayoutFile),
    [filesQuery.data],
  );

  useEffect(() => {
    const files = filesQuery.data;
    if (!files) return;
    for (const f of files) {
      if (!f.patch) continue;
      const lang = detectLang(f.filename);
      const hunks = parseUnifiedDiff(f.patch);
      if (hunks.length === 0) continue;
      const { oldSource, newSource, oldChunkStarts, newChunkStarts } = buildSources(hunks);
      void qc.prefetchQuery(codeTokenChunksQueryOptions(oldSource, lang, oldChunkStarts));
      void qc.prefetchQuery(codeTokenChunksQueryOptions(newSource, lang, newChunkStarts));
    }
  }, [filesQuery.data, qc]);

  const reviewCommentsQuery = usePrReviewComments(owner, repo, number);
  const reviewCommentsRef = useRef(reviewCommentsQuery.data);
  reviewCommentsRef.current = reviewCommentsQuery.data;

  const hooksCache = useRef(new Map<string, DiffReviewHooks>());
  const meDataRef = useRef(meQuery.data);
  meDataRef.current = meQuery.data;

  const getReviewHooks = useCallback(
    (filename: string): DiffReviewHooks | undefined => {
      if (!canReview) return undefined;
      let hooks = hooksCache.current.get(filename);
      if (!hooks) {
        const prk = draftPage(owner, repo, number);
        hooks = {
          useComposerLine: () => {
            const composer = useReviewStore(s => s.composerByPr[prk]);
            if (!composer || composer.path !== filename) return null;
            return { side: composer.side, line: composer.line };
          },
          onAddComment: (args) => {
            const s = useReviewStore.getState();
            s.startReview(owner, repo, number);
            s.openComposer(owner, repo, number, { path: filename, ...args });
          },
          hasComment: (args: { side: "LEFT" | "RIGHT"; line: number }) => {
            const comments = reviewCommentsRef.current;
            if (comments?.some((c: ReviewComment) => {
              const cSide = c.side ?? "RIGHT";
              const cLine = c.line ?? c.original_line ?? 0;
              return c.path === filename && cSide === args.side && cLine === args.line && !c.in_reply_to_id;
            })) return true;
            const s = useReviewStore.getState();
            const pendingList = s.pendingByPr[prk];
            if (pendingList?.some(
              (c: { path: string; side: string; line: number }) => c.path === filename && c.side === args.side && c.line === args.line,
            )) return true;
            const composer = s.composerByPr[prk];
            if (composer && composer.path === filename && composer.side === args.side && composer.line === args.line) return true;
            // A line keeps its comment box while it still holds draft text, so
            // moving to another line never hides what was typed here.
            return hasDraft(draftKey(prk, `inline:${filename}:${args.side}:${args.line}`));
          },
          renderLineTrailer: (args) => {
            if (!hooks!.hasComment!(args)) return null;
            return (
              <LineSlotContent owner={owner} repo={repo} number={number} path={filename} side={args.side} line={args.line} meLogin={meDataRef.current?.login} meAvatarUrl={meDataRef.current?.avatar_url} />
            );
          },
        };
        hooksCache.current.set(filename, hooks);
      }
      return hooks;
    },
    [canReview, owner, repo, number],
  );

  useEffect(() => {
    if (canReview) useReviewStore.getState().startReview(owner, repo, number);
  }, [canReview, owner, repo, number]);

  return (
    <div className="flex min-h-full flex-col bg-background">
      <div className="flex-1">
        {!Number.isSafeInteger(number) || number <= 0 || (prQuery.isError && !pr) ? (
          <Container className="py-20 text-center text-sm text-muted-foreground" role="alert">
            Could not load this pull request.
          </Container>
        ) : filesQuery.isError && !filesQuery.data ? (
          <Container className="py-20 text-center text-sm text-muted-foreground" role="alert">
            Could not load files for this pull request.
          </Container>
        ) : prQuery.isPending || filesQuery.isPending || !pr ? (
          <DiffLayoutSkeleton review sidebar={!filesQuery.data || filesQuery.data.length > 1} />
        ) : (
          <DiffLayout
            files={diffFiles}
            initialSidebarOpen={diffFiles.length > 1}
            owner={owner}
            repo={repo}
            headRef={pr.head.ref}
            baseRef={pr.base.ref}
            headSha={pr.head.sha}
            baseSha={pr.base.sha}
            getReviewHooks={getReviewHooks}
            reviewBar={
              <ReviewBarLeft owner={owner} repo={repo} number={number} pr={pr} uiState={uiState} />
            }
            beforeModeSlot={
              <ChangeStatsBadge additions={pr.additions} deletions={pr.deletions} className="shrink-0" />
            }
            reviewActions={
              <ReviewActions owner={owner} repo={repo} number={number} canReview={canReview} isAuthor={!!pr && pr.user?.login === meQuery.data?.login} />
            }
          />
        )}
      </div>
    </div>
  );
}

const LineSlotContent = memo(function LineSlotContent({
  owner, repo, number, path, side, line, meLogin, meAvatarUrl,
}: { owner: string; repo: string; number: number; path: string; side: "LEFT" | "RIGHT"; line: number; meLogin?: string; meAvatarUrl?: string }) {
  const store = useReviewStore();
  const prKey = draftPage(owner, repo, number);
  const inlineKey = draftKey(prKey, `inline:${path}:${side}:${line}`);
  const hasInlineDraft = useDraftsStore(s => inlineKey in s.drafts);

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
      {(isComposerHere || hasInlineDraft) && (
        <InlineComposer
          login={meLogin ?? "ghost"}
          avatarUrl={meAvatarUrl}
          owner={owner}
          repo={repo}
          onSubmit={(body: string) => {
            store.addPending(owner, repo, number, { path, side, line, body });
            if (isComposerHere) store.closeComposer(owner, repo, number);
          }}
          onCancel={() => {
            if (isComposerHere) store.closeComposer(owner, repo, number);
          }}
          submitLabel="Add review comment"
          draftKey={inlineKey}
        />
      )}
    </>
  );
});

function PendingCard({ comment, onRemove }: { comment: PendingComment; onRemove: () => void }) {
  return (
    <div className="diff-line-comment diff-thread py-3 pl-4 pr-4">
      <div className="max-w-2xl">
        <div className="flex items-center justify-between gap-2">
          <span className="text-caption font-medium text-primary">Pending</span>
          <button type="button" onClick={onRemove} className="text-caption text-muted-foreground transition-colors hover:text-destructive">Remove</button>
        </div>
        <p className="mt-1 text-body text-foreground [overflow-wrap:anywhere]">{comment.body}</p>
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

// ─── ReviewBar — merged into DiffLayout's sticky top bar ─────────────────

function CommentNav({ commentCount }: { commentCount: number }) {
  const [currentIdx, setCurrentIdx] = useState(-1);

  const getElements = () =>
    Array.from(document.querySelectorAll<HTMLElement>(".diff-line-comment"));

  function go(direction: 1 | -1) {
    const els = getElements();
    if (els.length === 0) return;
    const next = direction === 1
      ? (currentIdx + 1) % els.length
      : (currentIdx - 1 + els.length) % els.length;
    els[next]?.scrollIntoView({ behavior: "smooth", block: "center" });
    setCurrentIdx(next);
  }

  if (commentCount === 0) return null;

  return (
    <div className="flex items-center gap-1">
      <MessageSquare className="size-3.5 text-muted-foreground" />
      <span className="text-xs tabular-nums text-muted-foreground">
        {currentIdx >= 0 ? `${currentIdx + 1}/` : ""}{commentCount}
      </span>
      <button
        type="button"
        onClick={() => go(-1)}
        className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-1 focus-visible:ring-foreground/15"
        aria-label="Previous comment"
      >
        <ChevronUp className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={() => go(1)}
        className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-1 focus-visible:ring-foreground/15"
        aria-label="Next comment"
      >
        <ChevronDown className="size-3.5" />
      </button>
    </div>
  );
}

function ReviewBarLeft({
  owner, repo, number, pr, uiState,
}: {
  owner: string; repo: string; number: number;
  pr: PullRequest | undefined; uiState: PrUiState | null;
}) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <Link
        to="/$owner/$repo/pull/$number"
        params={{ owner, repo, number }}
        className="inline-flex shrink-0 items-center gap-1.5 text-ui text-muted-foreground outline-none transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back
      </Link>
      {pr && uiState && (
        <>
          <PrStatePill state={uiState} size="sm" />
          <h1 className="min-w-0 truncate text-ui font-normal text-foreground" title={`${pr.title} #${number}`}>
            {pr.title}
            <span className="ml-1.5 text-muted-foreground">#{number}</span>
          </h1>
        </>
      )}
    </div>
  );
}

function ReviewActions({
  owner, repo, number, canReview, isAuthor,
}: {
  owner: string; repo: string; number: number; canReview: boolean; isAuthor: boolean;
}) {
  const reviewMode = useReviewMode(owner, repo, number);
  const reviewHasDraft = useReviewHasDraft(owner, repo, number);
  const pending = usePendingComments(owner, repo, number);
  const cancelReview = useReviewStore(s => s.cancelReview);
  const reviewCommentsQuery = usePrReviewComments(owner, repo, number);

  if (!canReview) return null;

  return (
    <div className="ml-auto flex min-w-0 max-w-full flex-wrap items-center justify-end gap-3">
      <CommentNav
        commentCount={
          (reviewCommentsQuery.data?.filter(c => !c.in_reply_to_id).length ?? 0) + pending.length
        }
      />
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="text-xs tabular-nums text-muted-foreground" title={`${pending.length} pending ${pending.length === 1 ? "comment" : "comments"}`}>
          <span className="font-medium text-foreground">{pending.length}</span>{" "}
          pending
        </span>
        {(reviewMode || reviewHasDraft) && (
          <Button size="xs" variant="ghost" onClick={() => cancelReview(owner, repo, number)}>Cancel</Button>
        )}
        <PrReviewPopover
          owner={owner}
          repo={repo}
          number={number}
          isAuthor={isAuthor}
          pendingComments={pending}
        />
      </div>
    </div>
  );
}
