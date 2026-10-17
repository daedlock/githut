import { useCallback } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  accountStorage,
  currentOwner,
  followAccount,
  ownsMemory,
  type StorageOwner,
  updateAccountRecord,
} from "@/app/stores/accountStorage";
import { useAuthStore } from "@/app/stores/auth";
import { normalizeHref } from "@/app/workspace/model";

// ─── Drafts ──────────────────────────────────────────────────────────────────
//
// A draft is an unsent comment or review kept for a page until you send or
// discard it, even if its tab is closed. Each verified account has its own
// storage namespace (see stores/accountStorage). Drafts are keyed by page, not by tab,
// so closing a tab, reopening it (or the same page anywhere else), reloading
// and signing in again all bring the text back. Nothing here prompts.
//
// A page is a PR or an issue: `owner/repo/number`. GitHub numbers PRs and
// issues from one sequence, so the conversation, files and review views of a
// PR share a page. Each composer on a page owns a slot (`comment`,
// `reply:<id>`, `inline:<path>:<side>:<line>`, `review`). Pending inline review
// comments live in the review store (also persisted); `usePageHasDraft` looks
// at both.

const DRAFTS_NAME = "githut.drafts.v1";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

type Draft = { body: string; at: number };

type DraftsState = {
  /** `${page}#${slot}` → draft. Empty drafts are never stored. */
  drafts: Record<string, Draft>;
  setDraft: (key: string, body: string) => void;
  clearDraft: (key: string) => void;
  /** Drop every draft on `page` whose slot starts with `slotPrefix`. */
  clearDrafts: (page: string, slotPrefix?: string) => void;
};

export const useDraftsStore = create<DraftsState>()(
  persist(
    (set, get) => ({
      drafts: {},
      setDraft: (key, body) => {
        if (!body.trim()) {
          get().clearDraft(key);
          return;
        }
        set({ drafts: { ...get().drafts, [key]: { body, at: Date.now() } } });
      },
      clearDraft: (key) => {
        const { drafts } = get();
        if (!(key in drafts)) return;
        const { [key]: _, ...rest } = drafts;
        set({ drafts: rest });
      },
      clearDrafts: (page, slotPrefix = "") => {
        const prefix = `${page}#${slotPrefix}`;
        const { drafts } = get();
        const keys = Object.keys(drafts).filter((k) => k.startsWith(prefix));
        if (keys.length === 0) return;
        const rest = { ...drafts };
        for (const k of keys) delete rest[k];
        set({ drafts: rest });
      },
    }),
    {
      name: DRAFTS_NAME,
      storage: accountStorage<Pick<DraftsState, "drafts">>(),
      partialize: (s) => ({ drafts: s.drafts }),
      // Forget drafts nobody has touched in a month.
      merge: (persisted, current) => {
        const saved = (persisted as Partial<DraftsState> | undefined)?.drafts ?? {};
        const cutoff = Date.now() - MAX_AGE_MS;
        const drafts: Record<string, Draft> = {};
        for (const [k, d] of Object.entries(saved)) {
          if (d && typeof d.body === "string" && d.at > cutoff) drafts[k] = d;
        }
        return { ...current, drafts };
      },
    },
  ),
);

followAccount(DRAFTS_NAME, {
  rehydrate: () => useDraftsStore.persist.rehydrate(),
  snapshot: () => useDraftsStore.getState().drafts,
  adopt: (pending) => {
    if (Object.keys(pending).length === 0) return;
    useDraftsStore.setState({ drafts: { ...useDraftsStore.getState().drafts, ...pending } });
  },
});

/** Page key for a PR or issue. Matches the review store's PR key. */
export function draftPage(owner: string, repo: string, number: number): string {
  return `${owner.toLowerCase()}/${repo.toLowerCase()}/${number}`;
}

export function draftKey(page: string, slot: string): string {
  return `${page}#${slot}`;
}

const PAGE_HREF = /^\/([^/]+)\/([^/]+)\/(?:pull|pr|review|issues)\/(\d+)(?:\/|$)/;

/** The draft page an href shows, or null for pages that hold no drafts. */
export function draftPageFromHref(href: string): string | null {
  const m = normalizeHref(href).split(/[?#]/)[0]!.match(PAGE_HREF);
  return m ? draftPage(m[1]!, m[2]!, Number(m[3])) : null;
}

export function hasDraft(key: string): boolean {
  return key in useDraftsStore.getState().drafts;
}

// ─── Sending ─────────────────────────────────────────────────────────────────
//
// A draft stays stored while its request is in flight and is only cleared
// when the request succeeds, from the mutation's own onSuccess so it still runs
// after the composer or its tab is gone. A failed send leaves the text where it
// was. The owner is captured at submit, so a late success clears the sender's
// draft, never a draft of whoever is signed in now.

export type SentDraft = { key: string; body: string; owner: StorageOwner };

/** Capture a draft being sent: pass it with the mutation's variables. */
export function sentDraft(key: string, body: string): SentDraft {
  return { key, body: body.trim(), owner: currentOwner() };
}

/** The send succeeded: drop the draft unless it was edited since. */
export function clearSentDraft(sent: SentDraft | undefined) {
  if (!sent) return;
  const matches = (d: Draft | undefined) => !!d && d.body.trim() === sent.body;
  if (ownsMemory(sent.owner)) {
    const store = useDraftsStore.getState();
    if (matches(store.drafts[sent.key])) store.clearDraft(sent.key);
    return;
  }
  if (sent.owner.accountId == null) return;
  updateAccountRecord<Pick<DraftsState, "drafts">>(DRAFTS_NAME, sent.owner.accountId, (state) => {
    const drafts = { ...state.drafts };
    if (matches(drafts[sent.key])) delete drafts[sent.key];
    return { ...state, drafts };
  });
}

/** Clear drafts on `page` for `owner`, wherever that account's drafts live now. */
export function clearDraftsFor(owner: StorageOwner, page: string, slotPrefixes: string[]) {
  if (ownsMemory(owner)) {
    for (const prefix of slotPrefixes) useDraftsStore.getState().clearDrafts(page, prefix);
    return;
  }
  if (owner.accountId == null) return;
  updateAccountRecord<Pick<DraftsState, "drafts">>(DRAFTS_NAME, owner.accountId, (state) => {
    const drafts = { ...state.drafts };
    for (const k of Object.keys(drafts)) {
      if (slotPrefixes.some((prefix) => k.startsWith(`${page}#${prefix}`))) delete drafts[k];
    }
    return { ...state, drafts };
  });
}

/** A composer's text, kept as a draft under `key`: `[body, setBody, discard]`. */
export function useDraft(key: string): [string, (body: string) => void, () => void] {
  const accountId = useAuthStore((s) => s.accountId);
  const token = useAuthStore((s) => s.token);
  const body = useDraftsStore((s) => s.drafts[key]?.body ?? "");
  // A setter rendered for one account never writes into another's drafts.
  const set = useCallback(
    (next: string) => {
      if (ownsMemory({ accountId, token })) useDraftsStore.getState().setDraft(key, next);
    },
    [key, accountId, token],
  );
  const clear = useCallback(() => {
    if (ownsMemory({ accountId, token })) useDraftsStore.getState().clearDraft(key);
  }, [key, accountId, token]);
  return [body, set, clear];
}
