import { createJSONStorage } from "zustand/middleware";
import { useAuthStore } from "./auth";

/** Legacy unowned records stay untouched; only a verified account can open a namespace. */
export function accountStorage<T>() {
  return createJSONStorage<T>(() => ({
    getItem(name) {
      const id = useAuthStore.getState().accountId;
      try {
        const saved = id == null ? null : localStorage.getItem(`${name}.account.${id}`);
        // A corrupt destination must hydrate as empty, never leave the old account visible.
        if (saved) JSON.parse(saved);
        return saved;
      } catch {
        return null;
      }
    },
    setItem(name, value) {
      const id = useAuthStore.getState().accountId;
      try {
        if (id != null) localStorage.setItem(`${name}.account.${id}`, value);
      } catch {
        /* Drafts remain available in memory if storage is full. */
      }
    },
    removeItem(name) {
      const id = useAuthStore.getState().accountId;
      try {
        if (id != null) localStorage.removeItem(`${name}.account.${id}`);
      } catch {
        /* Storage may be disabled. */
      }
    },
  }));
}

/** Synchronous hydration replaces every public selector before the account switch returns. */
export function followDraftAccount(rehydrate: () => void | Promise<void>) {
  useAuthStore.subscribe((state, previous) => {
    if (state.accountId !== previous.accountId) void rehydrate();
  });
}
