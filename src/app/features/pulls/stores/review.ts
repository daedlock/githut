import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  accountStorage,
  followAccount,
  ownsMemory,
  type StorageOwner,
  updateAccountRecord,
} from "@/app/stores/accountStorage";
import { clearDraftsFor, draftKey, draftPage, useDraftsStore } from "@/app/stores/drafts";

// ─── Pending review store ──────────────────────────────────────────────────
//
// Review drafts live here until submit. Keyed per PR (owner/repo/number)
// so opening a different PR doesn't collide. Wiping happens explicitly
// (cancel / submit-success). Persisted, so a review in progress is a draft:
// it survives closing the tab, reloading and signing in again. Cancelling or
// submitting also drops the review's composer drafts (see stores/drafts).
//
// Three entities:
//   • pendingComments — drafts for inline comments, keyed by line
//   • composer        — the line whose comment box is open (persisted)
//   • reviewMode       — is the "Start review" cursor armed?
// All three are persisted. Pending comments older than a month are forgotten,
// a composer is only restored while its line still has draft text, and review
// mode only while the review still holds something to submit or discard.
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
const REVIEW_NAME = "githut.review-drafts.v1";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

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
    (set, get) => {
      return {
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
          const list = (get().pendingByPr[k] ?? []).filter((c) => c.id !== id);
          const next = { ...get().pendingByPr, [k]: list };
          if (list.length === 0) delete next[k];
          set({ pendingByPr: next });
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
          const next = { ...get().composerByPr };
          delete next[k];
          set({ composerByPr: next });
        },
      };
    },
    {
      name: REVIEW_NAME,
      storage: accountStorage<Pick<ReviewState, "modeByPr" | "pendingByPr" | "composerByPr">>(),
      partialize: (s) => ({
        modeByPr: s.modeByPr,
        pendingByPr: s.pendingByPr,
        composerByPr: s.composerByPr,
      }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<ReviewState> | undefined;
        // Pending ids are `-Date.now()` at creation.
        const cutoff = Date.now() - MAX_AGE_MS;
        const pendingByPr: Record<PrKey, PendingComment[]> = {};
        for (const [k, list] of Object.entries(saved?.pendingByPr ?? {})) {
          const kept = Array.isArray(list) ? list.filter((c) => c && -c.id > cutoff) : [];
          if (kept.length) pendingByPr[k] = kept;
        }
        // Drafts hydrate first (this module imports them), so an empty composer is dropped.
        const drafts = useDraftsStore.getState().drafts;
        const composerByPr: Record<PrKey, ActiveComposer> = {};
        for (const [k, c] of Object.entries(saved?.composerByPr ?? {})) {
          if (c && draftKey(k, `inline:${c.path}:${c.side}:${c.line}`) in drafts)
            composerByPr[k] = c;
        }
        const draftPages = new Set(
          Object.keys(drafts)
            .filter((k) => /#(?:review|inline:)/.test(k))
            .map((k) => k.slice(0, k.indexOf("#"))),
        );
        const modeByPr: Record<PrKey, boolean> = {};
        for (const [k, on] of Object.entries(saved?.modeByPr ?? {})) {
          if (on === true && (pendingByPr[k] || composerByPr[k] || draftPages.has(k)))
            modeByPr[k] = true;
        }
        return { ...current, modeByPr, pendingByPr, composerByPr };
      },
    },
  ),
);

followAccount(REVIEW_NAME, {
  rehydrate: () => useReviewStore.persist.rehydrate(),
  snapshot: () => {
    const { modeByPr, pendingByPr, composerByPr } = useReviewStore.getState();
    return { modeByPr, pendingByPr, composerByPr };
  },
  adopt: (pending) => {
    const now = useReviewStore.getState();
    const pendingByPr = { ...now.pendingByPr };
    for (const [k, list] of Object.entries(pending.pendingByPr)) {
      const ids = new Set((pendingByPr[k] ?? []).map((c) => c.id));
      pendingByPr[k] = [...(pendingByPr[k] ?? []), ...list.filter((c) => !ids.has(c.id))];
    }
    useReviewStore.setState({
      modeByPr: { ...now.modeByPr, ...pending.modeByPr },
      pendingByPr,
      composerByPr: { ...now.composerByPr, ...pending.composerByPr },
    });
  },
});

/**
 * A review was submitted: drop its pending comments, composer and drafts for
 * the account that submitted it, even if the window has switched accounts or
 * the PR's tab is gone.
 */
export function finishReview(owner: StorageOwner, o: string, r: string, n: number) {
  const k = prKey(o, r, n);
  if (ownsMemory(owner)) {
    useReviewStore.getState().cancelReview(o, r, n);
    return;
  }
  if (owner.accountId == null) return;
  updateAccountRecord<Pick<ReviewState, "modeByPr" | "pendingByPr" | "composerByPr">>(
    REVIEW_NAME,
    owner.accountId,
    (state) => {
      const modeByPr = { ...state.modeByPr };
      const pendingByPr = { ...state.pendingByPr };
      const composerByPr = { ...state.composerByPr };
      delete modeByPr[k];
      delete pendingByPr[k];
      delete composerByPr[k];
      return { ...state, modeByPr, pendingByPr, composerByPr };
    },
  );
  clearDraftsFor(owner, k, ["review", "inline:"]);
}

// ─── Selector helpers (keeps subscribers from re-rendering on unrelated PRs) ─

export function useReviewMode(o: string, r: string, n: number): boolean {
  return useReviewStore((s) => !!s.modeByPr[prKey(o, r, n)]);
}

/** Whether the PR's review holds anything to submit or discard. */
export function useReviewHasDraft(o: string, r: string, n: number): boolean {
  const k = prKey(o, r, n);
  const review = useReviewStore((s) => !!s.pendingByPr[k]?.length || !!s.composerByPr[k]);
  const drafts = useDraftsStore((s) =>
    Object.keys(s.drafts).some((d) => d.startsWith(`${k}#review`) || d.startsWith(`${k}#inline:`)),
  );
  return review || drafts;
}

export function usePendingComments(o: string, r: string, n: number): PendingComment[] {
  return useReviewStore((s) => s.pendingByPr[prKey(o, r, n)] ?? EMPTY);
}

export function useActiveComposer(o: string, r: string, n: number): ActiveComposer {
  return useReviewStore((s) => s.composerByPr[prKey(o, r, n)] ?? null);
}

const EMPTY: PendingComment[] = [];
