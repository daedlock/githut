import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type AuthState = {
  token: string | null;
  /** Verified GitHub user id, persisted only together with the token it belongs to. */
  accountId: number | null;
  /**
   * GitHub rejected the token mid-session (401). The token is kept so route
   * guards don't bounce every tab to /login: the workspace stays as it is,
   * requests pause, and a banner asks to sign in again.
   */
  expired: boolean;
  setToken: (token: string, accountId?: number) => void;
  verifyAccount: (token: string, accountId: number) => void;
  markExpired: () => void;
  clear: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      accountId: null,
      expired: false,
      setToken: (token, accountId) =>
        set((s) => ({
          token,
          expired: false,
          accountId: accountId ?? (s.token === token ? s.accountId : null),
        })),
      verifyAccount: (token, accountId) => set((s) => (s.token === token ? { accountId } : s)),
      markExpired: () => set((s) => (s.token && !s.expired ? { expired: true } : s)),
      clear: () => set({ token: null, accountId: null, expired: false }),
    }),
    {
      name: "githut.auth",
      storage: createJSONStorage(() => ({
        getItem: (name) => globalThis.localStorage?.getItem(name) ?? null,
        setItem: (name, value) => globalThis.localStorage?.setItem(name, value),
        removeItem: (name) => globalThis.localStorage?.removeItem(name),
      })),
      partialize: (s) => ({ token: s.token, accountId: s.accountId }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<AuthState> | undefined;
        const token = typeof saved?.token === "string" ? saved.token : null;
        const id = saved?.accountId;
        return {
          ...current,
          token,
          accountId:
            token && typeof id === "number" && Number.isSafeInteger(id) && id > 0 ? id : null,
        };
      },
    },
  ),
);
