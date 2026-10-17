import { useCallback } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { normalizeHref } from "@/app/stores/tabs";

// ─── Drafts ──────────────────────────────────────────────────────────────────
//
// A draft is an unsent comment or review kept for a page until you send or
// discard it, even if its tab is closed. Drafts are keyed by page, not by tab,
// so closing a tab, reopening it (or the same page anywhere else), reloading
// and signing in again all bring the text back. Nothing here prompts.
//
// A page is a PR or an issue: `owner/repo/number`. GitHub numbers PRs and
// issues from one sequence, so the conversation, files and review views of a
// PR share a page. Each composer on a page owns a slot (`comment`,
// `reply:<id>`, `inline:<path>:<side>:<line>`, `review`). Pending inline review
// comments live in the review store (also persisted); `usePageHasDraft` looks
// at both.

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
      name: "githut.drafts.v1",
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

/** Page key for a PR or issue. Matches the review store's PR key. */
export function draftPage(owner: string, repo: string, number: number): string {
  return `${owner}/${repo}/${number}`;
}

export function draftKey(page: string, slot: string): string {
  return `${page}#${slot}`;
}

const PAGE_HREF = /^\/([^/]+)\/([^/]+)\/(?:pull|pr|review|issues)\/(\d+)(?:\/|$)/;

/** The draft page an href shows, or null for pages that hold no drafts. */
export function draftPageFromHref(href: string): string | null {
  const m = normalizeHref(href).split(/[?#]/)[0]!.match(PAGE_HREF);
  return m ? `${m[1]}/${m[2]}/${m[3]}` : null;
}

export function hasDraft(key: string): boolean {
  return key in useDraftsStore.getState().drafts;
}

/** A composer's text, kept as a draft under `key`: `[body, setBody, discard]`. */
export function useDraft(key: string): [string, (body: string) => void, () => void] {
  const body = useDraftsStore((s) => s.drafts[key]?.body ?? "");
  const set = useCallback((next: string) => useDraftsStore.getState().setDraft(key, next), [key]);
  const clear = useCallback(() => useDraftsStore.getState().clearDraft(key), [key]);
  return [body, set, clear];
}
