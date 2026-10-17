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
/** Owner and repo names are case-insensitive on GitHub; paths and queries are not. */
const RESERVED = new Set(["settings", "login", "playground"]);
export function canonicalHref(href: string): string {
  const normalized = normalizeHref(href);
  const match = /^\/([^/?#]+)\/([^/?#]+)(.*)$/.exec(normalized);
  if (!match || RESERVED.has(match[1]!.toLowerCase())) return normalized;
  return `/${match[1]!.toLowerCase()}/${match[2]!.toLowerCase()}${match[3]}`;
}
export const favoriteId = (item: FavoriteInput) => `${item.kind}:${canonicalHref(item.href)}`;
/** The Inbox is always in the sidebar; it is never a favorite. */
export const canFavorite = (href: string) => normalizeHref(href).split(/[?#]/)[0] !== "/";
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
          if (!canFavorite(item.href)) return;
          const href = canonicalHref(item.href);
          const entry = { ...item, href, id: favoriteId(item) };
          set((state) => {
            const items = state.accounts[accountId] ?? [];
            // One row per destination: a repo favorite and a view favorite of
            // the repo's Code page are the same place, and the repo one wins.
            const same = items.find((saved) => canonicalHref(saved.href) === href);
            if (same && (same.kind === "repo" || entry.kind === "view")) return state;
            const rest = items.filter((saved) => saved !== same);
            return { accounts: { ...state.accounts, [accountId]: [...rest, entry] } };
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
