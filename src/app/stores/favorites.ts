import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { normalizeHref } from "@/app/workspace/model";

export type Favorite = { id: string; kind: "repo" | "view"; href: string };
type FavoriteInput = Pick<Favorite, "kind" | "href">;
type FavoritesState = {
  accounts: Record<string, Favorite[]>;
  forAccount: (accountId: number | null) => Favorite[];
  add: (accountId: number | null, item: FavoriteInput) => void;
  remove: (accountId: number | null, id: string) => void;
};
const EMPTY: Favorite[] = [];
export const favoriteId = (item: FavoriteInput) => `${item.kind}:${normalizeHref(item.href)}`;
const validAccount = (id: number | null): id is number => Number.isSafeInteger(id) && (id ?? 0) > 0;

/** Local navigation preferences. Callers supply identity verified by the auth store. */
export const createFavoritesStore = (storage?: StateStorage) =>
  create<FavoritesState>()(
    persist(
      (set, get) => ({
        accounts: {},
        forAccount: (id) => (validAccount(id) ? (get().accounts[id] ?? EMPTY) : EMPTY),
        add: (accountId, item) => {
          if (!validAccount(accountId) || !item.href.startsWith("/") || item.href.startsWith("//"))
            return;
          const entry = { ...item, href: normalizeHref(item.href), id: favoriteId(item) };
          set((state) => {
            const items = state.accounts[accountId] ?? [];
            if (items.some((saved) => saved.id === entry.id)) return state;
            return { accounts: { ...state.accounts, [accountId]: [...items, entry] } };
          });
        },
        remove: (accountId, id) => {
          if (!validAccount(accountId)) return;
          set((state) => ({
            accounts: {
              ...state.accounts,
              [accountId]: (state.accounts[accountId] ?? []).filter((item) => item.id !== id),
            },
          }));
        },
      }),
      {
        name: "githut.favorites.v1",
        storage: createJSONStorage(() => storage ?? localStorage),
        partialize: ({ accounts }) => ({ accounts }),
      },
    ),
  );
export const useFavoritesStore = createFavoritesStore();
