import {
  type CSSProperties,
  createContext,
  memo,
  type ReactNode,
  useContext,
  useMemo,
} from "react";
import { cn } from "@/app/lib/cn";
import { repoHue, repoMarkLetter, repoMarkLetters } from "@/app/lib/repoMark";
import { tabRepo } from "@/app/lib/tabMeta";
import { useAuthStore } from "@/app/stores/auth";
import { useFavoritesStore } from "@/app/stores/favorites";
import { hrefPathname, islands } from "@/app/workspace/model";
import { useWorkspaceStore } from "@/app/workspace/store";

// ─── RepoMark ──────────────────────────────────────────────────────────────
//
// Rounded square with the repo's initial (GLOSSARY → Repo mark). Colour and
// letter derive from the repo's full name (lib/repoMark). With the colour cue
// turned off (`<html data-repo-color="off">`) the mark stays neutral.
//
// Letters disambiguate only among repos the user is working with: open tabs
// and favorites. Both are local state, so a mark never flips once the network
// answers, and nothing crawls the account's repositories for it.

const EMPTY = new Map<string, string>();
const LettersContext = createContext<ReadonlyMap<string, string>>(EMPTY);

/** Newline-joined so the selector result compares by value. */
function useOpenRepos(): string {
  return useWorkspaceStore((s) => {
    const repos = new Set<string>();
    for (const island of islands(s.workspace.layout))
      for (const t of island.tabs) {
        const r = tabRepo(hrefPathname(t.href));
        if (r) repos.add(r.toLowerCase());
      }
    return [...repos].sort().join("\n");
  });
}

function useFavoriteRepos(): string {
  const accountId = useAuthStore((state) => state.accountId);
  const favorites = useFavoritesStore((state) => state.forAccount(accountId));
  return useMemo(() => {
    const repos = new Set<string>();
    for (const item of favorites) {
      const r = tabRepo(hrefPathname(item.href));
      if (r) repos.add(r.toLowerCase());
    }
    return [...repos].sort().join("\n");
  }, [favorites]);
}

/** Computes the letter map once; marks read it and re-render only when it changes. */
export function RepoMarkScope({ children }: { children: ReactNode }) {
  const open = useOpenRepos();
  const favorites = useFavoriteRepos();
  const letters = useMemo(
    () => repoMarkLetters(`${open}\n${favorites}`.split("\n").filter(Boolean)),
    [open, favorites],
  );
  return <LettersContext.Provider value={letters}>{children}</LettersContext.Provider>;
}

export const RepoMark = memo(function RepoMark({
  repo,
  size = "md",
  className,
}: {
  /** `owner/name` */
  repo: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const letter = useContext(LettersContext).get(repo.toLowerCase()) ?? repoMarkLetter(repo, []);

  return (
    <span
      aria-hidden
      data-repo-mark
      style={{ "--rc": `oklch(var(--repo-l) var(--repo-c) ${repoHue(repo)})` } as CSSProperties}
      className={cn(
        "inline-grid shrink-0 place-items-center font-sans font-semibold leading-none tracking-normal",
        "bg-[color-mix(in_oklab,var(--rc)_20%,var(--color-bg-subtle))] text-(--rc)",
        "ring-1 ring-[color:color-mix(in_oklab,var(--rc)_35%,transparent)] ring-inset",
        "[:root[data-repo-color=off]_&]:bg-(--color-bg-sunken) [:root[data-repo-color=off]_&]:text-muted-foreground",
        "[:root[data-repo-color=off]_&]:ring-border",
        // The glyph is an identity graphic, so it uses the mark-glyph scale
        // (DESIGN.md → Repo marks) rather than running-text sizes.
        size === "sm" ? "size-3.5 rounded-sm text-mark-sm" : "size-4 rounded-md text-mark",
        className,
      )}
    >
      {letter}
    </span>
  );
});
