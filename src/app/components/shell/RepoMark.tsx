import type { CSSProperties } from "react";

import { cn } from "@/app/lib/cn";
import { repoHue, repoMarkLetter } from "@/app/lib/repoMark";
import { tabRepo } from "@/app/lib/tabMeta";
import { hrefPathname, islands } from "@/app/workspace/model";
import { useWorkspaceStore } from "@/app/workspace/store";

// ─── RepoMark ──────────────────────────────────────────────────────────────
//
// Rounded square with the repo's initial (GLOSSARY → Repo mark). Colour and
// letter derive from the repo's full name (lib/repoMark). With the colour cue
// turned off (`<html data-repo-color="off">`) the mark stays neutral.

/** Repos with an open tab, newline-joined so selectors compare cheaply. */
function useReposInView(): string {
  return useWorkspaceStore((s) => {
    const repos = new Set<string>();
    for (const t of islands(s.workspace.layout).flatMap((i) => i.tabs)) {
      const r = tabRepo(hrefPathname(t.href));
      if (r) repos.add(r.toLowerCase());
    }
    return [...repos].sort().join("\n");
  });
}

export function RepoMark({
  repo,
  size = "md",
  className,
}: {
  /** `owner/name` */
  repo: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const inView = useReposInView();
  const letter = repoMarkLetter(repo, inView ? inView.split("\n") : []);

  return (
    <span
      aria-hidden
      data-repo-mark
      style={{ "--rc": `oklch(var(--repo-l) var(--repo-c) ${repoHue(repo)})` } as CSSProperties}
      className={cn(
        "inline-grid shrink-0 place-items-center font-sans font-[650] leading-none tracking-normal",
        "bg-[color-mix(in_oklab,var(--rc)_20%,var(--color-bg-subtle))] text-(--rc)",
        "shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--rc)_35%,transparent)]",
        "[:root[data-repo-color=off]_&]:bg-(--color-bg-sunken) [:root[data-repo-color=off]_&]:text-muted-foreground",
        "[:root[data-repo-color=off]_&]:shadow-[inset_0_0_0_1px_var(--color-border)]",
        // The mark's glyph is an identity graphic, not running text, so it
        // sits below the type scale like an icon does.
        size === "sm" ? "size-3.5 rounded-sm text-[8.5px]" : "size-4 rounded-md text-[9.5px]",
        className,
      )}
    >
      {letter}
    </span>
  );
}
