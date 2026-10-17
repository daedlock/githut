import { create } from "zustand";
import { persist } from "zustand/middleware";

type AuthState = {
  token: string | null;
  /**
   * GitHub rejected the token mid-session (401). The token is kept so route
   * guards don't bounce every tab to /login: the workspace stays as it is,
   * requests pause, and a banner asks to sign in again.
   */
  expired: boolean;
  setToken: (token: string) => void;
  markExpired: () => void;
  clear: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      expired: false,
      setToken: (token) => set({ token, expired: false }),
      markExpired: () => set((s) => (s.token && !s.expired ? { expired: true } : s)),
      clear: () => set({ token: null, expired: false }),
    }),
    { name: "githut.auth", partialize: (s) => ({ token: s.token }) },
  ),
);
