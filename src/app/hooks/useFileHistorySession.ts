import { useNavigate, useParams, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo } from "react";
import type { CommitFile, CommitDetail } from "@/app/hooks/useRepoCommit";
import { useRepoCommit } from "@/app/hooks/useRepoCommit";
import type { CommitSummary } from "@/app/hooks/useRepoCommits";
import { useRepoFileHistory } from "@/app/hooks/useRepoFileHistory";
import { fileHistoryClearSearch, type FileHistorySearch } from "@/app/lib/fileHistorySearch";

const PREFETCH_THRESHOLD = 5;

export type FileHistorySession = {
  open: boolean;
  owner: string | undefined;
  repo: string | undefined;
  path: string | undefined;
  branch: string | undefined;
  /** Full commit list including merges — feeds the rail. */
  allCommits: CommitSummary[];
  /** Merge-skipped list — feeds the linear prev/next journey. */
  linearCommits: CommitSummary[];
  /** Active commit SHA (whatever the URL points at). */
  activeSha: string | undefined;
  /** Index of activeSha within linearCommits. -1 if not on the linear path (e.g. user clicked a merge in the rail). */
  cursorIndex: number;
  /** 1-indexed position string for display: "12 / 47+". */
  positionLabel: string;
  /** Hooks for prev/next/end-of-list states. Derived from cursorIndex. */
  hasPrev: boolean;
  hasNext: boolean;
  /** Active commit's full detail (with files[] patches). */
  commitDetail: CommitDetail | undefined;
  isCommitLoading: boolean;
  /** The file entry from commitDetail.files matching our path (renames followed via previous_filename). */
  currentFile: CommitFile | undefined;
  /** History query state. */
  isHistoryLoading: boolean;
  isHistoryError: boolean;
  isFetchingMore: boolean;
  hasMoreHistory: boolean;
  fetchMoreHistory: () => void;
  /** Rail open/closed (URL-backed). */
  railOpen: boolean;
  toggleRail: () => void;
  /** Navigation. All replace URL state except close, which pops. */
  next: () => void;
  prev: () => void;
  jumpTo: (sha: string) => void;
  close: () => void;
};

export function useFileHistorySession(): FileHistorySession {
  const navigate = useNavigate();
  const search = useRouterState({
    select: (s) => s.location.search as FileHistorySearch,
  });
  const params = useParams({ strict: false }) as {
    owner?: string;
    repo?: string;
  };

  const owner = params.owner;
  const repo = params.repo;
  const path = search.fhPath;
  const branch = search.fhBranch;
  const activeSha = search.fhSha;
  const railOpen = search.fhRail === "1";
  const open = !!path && !!owner && !!repo && !!branch;

  const historyQuery = useRepoFileHistory(
    owner ?? "",
    repo ?? "",
    path ?? "",
    branch,
  );

  const allCommits = useMemo(
    () => historyQuery.data?.pages.flat() ?? [],
    [historyQuery.data],
  );

  // Drop merges from the linear journey. Rail keeps them with a badge.
  const linearCommits = useMemo(
    () => allCommits.filter((c) => c.parents.length <= 1),
    [allCommits],
  );

  // Use the entry-point ref (could be a branch name OR a SHA) to pin the
  // first commit-detail fetch. Once that resolves, we know the real SHA,
  // which is what the linear cursor index keys on. This keeps the URL
  // round-trippable when users land via a branch name (e.g. "main") and
  // also when they paste a shareable URL with a real SHA.
  const initialRef = activeSha ?? linearCommits[0]?.sha;
  const commitQuery = useRepoCommit(owner ?? "", repo ?? "", initialRef);
  const resolvedSha = commitQuery.data?.sha ?? activeSha;

  // Cursor index reflects the *URL-active* sha first, so prev/next clicks
  // update the position counter + timeline dot immediately. We only fall
  // back to the resolved sha when the active value is a branch name (the
  // initial entry from code view) or doesn't match any loaded commit yet.
  const cursorIndex = useMemo(() => {
    if (linearCommits.length === 0) return -1;
    if (activeSha) {
      const idx = linearCommits.findIndex((c) => c.sha === activeSha);
      if (idx >= 0) return idx;
    }
    if (resolvedSha && resolvedSha !== activeSha) {
      const idx = linearCommits.findIndex((c) => c.sha === resolvedSha);
      if (idx >= 0) return idx;
    }
    return 0;
  }, [activeSha, resolvedSha, linearCommits]);

  // What we expose as activeSha must update *immediately* when the URL
  // changes — otherwise the sha chip and "open commit" link lag behind
  // during placeholder transitions. We prefer the URL value when it's
  // a real sha in our list, falling back to the resolved sha only for
  // initial loads via a branch name.
  const currentSha = useMemo(() => {
    if (activeSha && linearCommits.some((c) => c.sha === activeSha)) {
      return activeSha;
    }
    return resolvedSha;
  }, [activeSha, resolvedSha, linearCommits]);

  const currentFile = useMemo(() => {
    if (!commitQuery.data || !path) return undefined;
    return commitQuery.data.files.find(
      (f) => f.filename === path || f.previous_filename === path,
    );
  }, [commitQuery.data, path]);

  // Auto-prefetch the next history page when the cursor is approaching
  // the loaded edge — keeps prev/next instant for typical journeys.
  useEffect(() => {
    if (
      open &&
      cursorIndex >= 0 &&
      cursorIndex >= linearCommits.length - PREFETCH_THRESHOLD &&
      historyQuery.hasNextPage &&
      !historyQuery.isFetchingNextPage
    ) {
      void historyQuery.fetchNextPage();
    }
  }, [
    open,
    cursorIndex,
    linearCommits.length,
    historyQuery.hasNextPage,
    historyQuery.isFetchingNextPage,
    historyQuery.fetchNextPage,
  ]);

  const setSearchPartial = useCallback(
    (next: Partial<FileHistorySearch>, opts: { replace?: boolean } = {}) => {
      const merged = { ...search, ...next };
      navigate({
        to: ".",
        // biome-ignore lint/suspicious/noExplicitAny: cross-route search merge — each route owns its own schema validation.
        search: merged as any,
        replace: opts.replace ?? false,
        resetScroll: false,
      });
    },
    [navigate, search],
  );

  const close = useCallback(() => {
    setSearchPartial(fileHistoryClearSearch());
  }, [setSearchPartial]);

  // Older = deeper into history. List is newest-first (index 0 = newest),
  // so "next" advances to a higher index (older), "prev" to a lower one
  // (newer). Matches the temporal-flow arrow metaphor: → goes back in time.
  const next = useCallback(() => {
    if (cursorIndex < 0) return;
    const target = linearCommits[cursorIndex + 1];
    if (!target) return;
    setSearchPartial({ fhSha: target.sha }, { replace: true });
  }, [cursorIndex, linearCommits, setSearchPartial]);

  const prev = useCallback(() => {
    if (cursorIndex <= 0) return;
    const target = linearCommits[cursorIndex - 1];
    if (!target) return;
    setSearchPartial({ fhSha: target.sha }, { replace: true });
  }, [cursorIndex, linearCommits, setSearchPartial]);

  const jumpTo = useCallback(
    (sha: string) => setSearchPartial({ fhSha: sha }, { replace: true }),
    [setSearchPartial],
  );

  const toggleRail = useCallback(
    () =>
      setSearchPartial(
        { fhRail: railOpen ? undefined : "1" },
        { replace: true },
      ),
    [railOpen, setSearchPartial],
  );

  const total = linearCommits.length;
  const positionLabel = useMemo(() => {
    if (cursorIndex < 0) return total === 0 ? "—" : `? / ${total}${historyQuery.hasNextPage ? "+" : ""}`;
    return `${cursorIndex + 1} / ${total}${historyQuery.hasNextPage ? "+" : ""}`;
  }, [cursorIndex, total, historyQuery.hasNextPage]);

  return {
    open,
    owner,
    repo,
    path,
    branch,
    allCommits,
    linearCommits,
    activeSha: currentSha,
    cursorIndex,
    positionLabel,
    hasPrev: cursorIndex > 0,
    hasNext: cursorIndex >= 0 && cursorIndex < linearCommits.length - 1,
    commitDetail: commitQuery.data,
    isCommitLoading: commitQuery.isPending && !!currentSha,
    currentFile,
    isHistoryLoading: historyQuery.isPending,
    isHistoryError: historyQuery.isError,
    isFetchingMore: historyQuery.isFetchingNextPage,
    hasMoreHistory: !!historyQuery.hasNextPage,
    fetchMoreHistory: () => void historyQuery.fetchNextPage(),
    railOpen,
    toggleRail,
    next,
    prev,
    jumpTo,
    close,
  };
}
