import { create } from "zustand";
import { persist } from "zustand/middleware";
import { draftPage, useDraftsStore } from "@/app/stores/drafts";

// ─── Pending review store ──────────────────────────────────────────────────
//
// Review drafts live here until submit. Keyed per PR (owner/repo/number)
// so opening a different PR doesn't collide. Wiping happens explicitly
// (cancel / submit-success). Persisted, so a review in progress is a draft:
// it survives closing the tab, reloading and signing in again. Cancelling or
// submitting also drops the review's composer drafts (see stores/drafts).
//
// Two entities:
//   • pendingComments — drafts for inline comments, keyed by line
//   • reviewMode       — is the "Start review" cursor armed?
// Nothing else lives here; existing server state continues to be owned
// by TanStack Query.

export type PendingSide = "LEFT" | "RIGHT";

export type PendingComment = {
  /** Local-only id; negative so it can't collide with server ids. */
  id: number;
  path: string;
  side: PendingSide;
  line: number;
  body: string;
};

type PrKey = string; // `${owner}/${repo}/${number}`

const prKey = draftPage;

export type ActiveComposer = {
  path: string;
  side: PendingSide;
  line: number;
} | null;

type ReviewState = {
  modeByPr: Record<PrKey, boolean>;
  pendingByPr: Record<PrKey, PendingComment[]>;
  composerByPr: Record<PrKey, ActiveComposer>;

  startReview(o: string, r: string, n: number): void;
  cancelReview(o: string, r: string, n: number): void;
  addPending(o: string, r: string, n: number, c: Omit<PendingComment, "id">): number;
  updatePending(o: string, r: string, n: number, id: number, body: string): void;
  removePending(o: string, r: string, n: number, id: number): void;
  clearPending(o: string, r: string, n: number): void;
  openComposer(o: string, r: string, n: number, c: ActiveComposer): void;
  closeComposer(o: string, r: string, n: number): void;
};

export const useReviewStore = create<ReviewState>()(
  persist(
    (set, get) => ({
      modeByPr: {},
      pendingByPr: {},
      composerByPr: {},

      startReview: (o, r, n) => {
        const k = prKey(o, r, n);
        set({ modeByPr: { ...get().modeByPr, [k]: true } });
      },

      cancelReview: (o, r, n) => {
        const k = prKey(o, r, n);
        const { modeByPr, pendingByPr, composerByPr } = get();
        const nextMode = { ...modeByPr };
        const nextPending = { ...pendingByPr };
        const nextComposer = { ...composerByPr };
        delete nextMode[k];
        delete nextPending[k];
        delete nextComposer[k];
        set({ modeByPr: nextMode, pendingByPr: nextPending, composerByPr: nextComposer });
        const drafts = useDraftsStore.getState();
        drafts.clearDrafts(k, "review");
        drafts.clearDrafts(k, "inline:");
      },

      addPending: (o, r, n, c) => {
        const k = prKey(o, r, n);
        const id = -Date.now();
        const list = get().pendingByPr[k] ?? [];
        set({
          pendingByPr: { ...get().pendingByPr, [k]: [...list, { ...c, id }] },
        });
        return id;
      },

      updatePending: (o, r, n, id, body) => {
        const k = prKey(o, r, n);
        const list = get().pendingByPr[k] ?? [];
        set({
          pendingByPr: {
            ...get().pendingByPr,
            [k]: list.map((c) => (c.id === id ? { ...c, body } : c)),
          },
        });
      },

      removePending: (o, r, n, id) => {
        const k = prKey(o, r, n);
        const list = get().pendingByPr[k] ?? [];
        set({
          pendingByPr: {
            ...get().pendingByPr,
            [k]: list.filter((c) => c.id !== id),
          },
        });
      },

      clearPending: (o, r, n) => {
        const k = prKey(o, r, n);
        const next = { ...get().pendingByPr };
        delete next[k];
        set({ pendingByPr: next });
      },

      openComposer: (o, r, n, c) => {
        const k = prKey(o, r, n);
        set({ composerByPr: { ...get().composerByPr, [k]: c } });
      },

      closeComposer: (o, r, n) => {
        const k = prKey(o, r, n);
        set({ composerByPr: { ...get().composerByPr, [k]: null } });
      },
    }),
    {
      name: "githut.review-drafts.v1",
      partialize: (s) => ({ pendingByPr: s.pendingByPr, composerByPr: s.composerByPr }),
    },
  ),
);

// ─── Selector helpers (keeps subscribers from re-rendering on unrelated PRs) ─

export function useReviewMode(o: string, r: string, n: number): boolean {
  return useReviewStore((s) => !!s.modeByPr[prKey(o, r, n)]);
}

export function usePendingComments(o: string, r: string, n: number): PendingComment[] {
  return useReviewStore((s) => s.pendingByPr[prKey(o, r, n)] ?? EMPTY);
}

export function useActiveComposer(o: string, r: string, n: number): ActiveComposer {
  return useReviewStore((s) => s.composerByPr[prKey(o, r, n)] ?? null);
}

const EMPTY: PendingComment[] = [];
