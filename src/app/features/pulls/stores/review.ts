import { create } from "zustand";

// ─── Pending review store ──────────────────────────────────────────────────
//
// Review drafts live here until submit. Keyed per PR (owner/repo/number)
// so opening a different PR doesn't collide. Wiping happens explicitly
// (cancel / submit-success). Zustand-local — no persistence — a review
// in progress that the user throws away a refresh on is expected.
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

const prKey = (o: string, r: string, n: number) => `${o}/${r}/${n}`;

type ReviewState = {
  /** PRs in active-review mode. Exit on submit or cancel. */
  modeByPr: Record<PrKey, boolean>;
  /** pendingByPr[pr][commentId] = draft. Ordered by insertion via Map. */
  pendingByPr: Record<PrKey, PendingComment[]>;

  startReview(o: string, r: string, n: number): void;
  cancelReview(o: string, r: string, n: number): void;
  addPending(o: string, r: string, n: number, c: Omit<PendingComment, "id">): number;
  updatePending(o: string, r: string, n: number, id: number, body: string): void;
  removePending(o: string, r: string, n: number, id: number): void;
  clearPending(o: string, r: string, n: number): void;
};

export const useReviewStore = create<ReviewState>()((set, get) => ({
  modeByPr: {},
  pendingByPr: {},

  startReview: (o, r, n) => {
    const k = prKey(o, r, n);
    set({ modeByPr: { ...get().modeByPr, [k]: true } });
  },

  cancelReview: (o, r, n) => {
    const k = prKey(o, r, n);
    const { modeByPr, pendingByPr } = get();
    const nextMode = { ...modeByPr };
    const nextPending = { ...pendingByPr };
    delete nextMode[k];
    delete nextPending[k];
    set({ modeByPr: nextMode, pendingByPr: nextPending });
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
}));

// ─── Selector helpers (keeps subscribers from re-rendering on unrelated PRs) ─

export function useReviewMode(o: string, r: string, n: number): boolean {
  return useReviewStore((s) => !!s.modeByPr[prKey(o, r, n)]);
}

export function usePendingComments(
  o: string,
  r: string,
  n: number,
): PendingComment[] {
  return useReviewStore((s) => s.pendingByPr[prKey(o, r, n)] ?? EMPTY);
}

const EMPTY: PendingComment[] = [];
