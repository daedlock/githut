import { create } from "zustand";
import { createJSONStorage } from "zustand/middleware";
import { useAuthStore } from "./auth";

// ─── Per-account storage ─────────────────────────────────────────────────────
//
// Drafts, pending reviews and remembered tab titles are kept per GitHub
// account: `<name>.account.<id>`. While a token is signed in but its account
// isn't verified yet (right after sign-in, or while GET /user fails), writes
// go to `<name>.pending` so nothing typed is lost; once the token's account is
// known the buffer is adopted into that account's namespace. A pending buffer
// whose token is replaced before it was verified is dropped: nobody can say
// which account it belonged to.

/** The owner of a write: the verified account, else the unverified token. */
export type StorageOwner = { accountId: number | null; token: string | null };

export function currentOwner(): StorageOwner {
  const { accountId, token } = useAuthStore.getState();
  return { accountId, token };
}

/** Whether `owner` still owns what's in memory now (an adopted pending buffer counts). */
export function ownsMemory(owner: StorageOwner): boolean {
  const now = useAuthStore.getState();
  if (owner.accountId != null) return owner.accountId === now.accountId;
  return owner.token != null && owner.token === now.token;
}

export function accountKey(name: string, accountId: number): string {
  return `${name}.account.${accountId}`;
}

function storageKey(name: string): string | null {
  const { accountId, token } = useAuthStore.getState();
  if (accountId != null) return accountKey(name, accountId);
  return token ? `${name}.pending` : null;
}

/** Set when a write fails (storage full or blocked): drafts then live in memory only. */
export const useStorageHealth = create(() => ({ writeFailed: false }));

function writeFailed(failed: boolean) {
  if (useStorageHealth.getState().writeFailed !== failed)
    useStorageHealth.setState({ writeFailed: failed });
}

export function accountStorage<T>() {
  return createJSONStorage<T>(() => ({
    getItem(name) {
      const key = storageKey(name);
      try {
        const saved = key == null ? null : localStorage.getItem(key);
        // A corrupt destination must hydrate as empty, never leave the old account visible.
        if (saved) JSON.parse(saved);
        return saved;
      } catch {
        return null;
      }
    },
    setItem(name, value) {
      const key = storageKey(name);
      if (key == null) return;
      try {
        localStorage.setItem(key, value);
        writeFailed(false);
      } catch {
        writeFailed(true);
      }
    },
    removeItem(name) {
      const key = storageKey(name);
      try {
        if (key != null) localStorage.removeItem(key);
      } catch {
        /* Storage may be disabled. */
      }
    },
  }));
}

/**
 * Rewrite another account's saved state in place. Used when a request sent by
 * one account succeeds after the window switched to another.
 */
export function updateAccountRecord<S>(
  name: string,
  accountId: number,
  update: (state: Partial<S>) => Partial<S>,
) {
  const key = accountKey(name, accountId);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const data = JSON.parse(raw) as { state?: Partial<S>; version?: number };
    localStorage.setItem(key, JSON.stringify({ ...data, state: update(data.state ?? {}) }));
  } catch {
    /* Corrupt or unavailable storage: nothing to clean up. */
  }
}

type FollowOptions<S> = {
  rehydrate: () => void | Promise<void>;
  /** In-memory state before the account's namespace loads. */
  snapshot: () => S;
  /** Merge the unverified buffer into the freshly loaded account state. */
  adopt: (pending: S) => void;
};

/**
 * Keep a persisted store on the signed-in account's namespace: swap namespaces
 * when the account changes, adopt the unverified buffer once its account is
 * known, and pick up writes from other windows. Hydration is synchronous, so
 * every selector shows the new account before the switch returns.
 */
export function followAccount<S>(name: string, { rehydrate, snapshot, adopt }: FollowOptions<S>) {
  useAuthStore.subscribe((state, previous) => {
    if (state.accountId === previous.accountId && state.token === previous.token) return;
    const pendingKey = `${name}.pending`;
    if (previous.accountId == null && state.accountId != null && state.token === previous.token) {
      const pending = snapshot();
      void rehydrate();
      adopt(pending);
      removeKey(pendingKey);
      return;
    }
    if (previous.accountId == null && previous.token !== state.token) removeKey(pendingKey);
    void rehydrate();
  });

  // Another window wrote this account's state: load it so the next write here
  // doesn't overwrite it with an older copy.
  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("storage", (e) => {
      if (e.storageArea && e.storageArea !== globalThis.localStorage) return;
      if (e.key === null || e.key === storageKey(name)) void rehydrate();
    });
  }
}

function removeKey(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* Storage may be disabled. */
  }
}
