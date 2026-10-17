import {
  CodeIcon,
  GitCommitIcon,
  GitPullRequestIcon,
  IssueOpenedIcon,
  PlayIcon,
} from "@primer/octicons-react";
import { MoreHorizontal } from "lucide-react";

import { Button } from "@/app/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import { cn } from "@/app/lib/cn";
import { openInNewTab } from "@/app/lib/tabActions";
import { type RepoSection, tabRepo, tabSection } from "@/app/lib/tabMeta";
import { hrefPathname } from "@/app/workspace/model";

// ─── SectionMenu ───────────────────────────────────────────────────────────
//
// The repo sections (Code, Commits, PRs, Issues, Actions) in an island
// header. An island belongs to no repo, so they act on the island's selected
// tab's repo and say so in their labels.
//
// Icons at rest; hovering the group slides the labels out, and the current
// section keeps its label. Narrow islands drop the labels (≤620px) and then
// fold the whole group into one "⋯" menu (≤480px), so tabs keep most of the
// header. Sections are launchers: they jump to an open tab showing the
// section, or open a new one — never replacing the current tab's page.

const SECTIONS: readonly {
  id: RepoSection;
  suffix: string;
  label: string;
  icon: typeof CodeIcon;
}[] = [
  { id: "code", suffix: "/code", label: "Code", icon: CodeIcon },
  { id: "commits", suffix: "/commits", label: "Commits", icon: GitCommitIcon },
  { id: "pulls", suffix: "/pulls", label: "PRs", icon: GitPullRequestIcon },
  { id: "issues", suffix: "/issues", label: "Issues", icon: IssueOpenedIcon },
  { id: "actions", suffix: "/actions", label: "Actions", icon: PlayIcon },
];

export function SectionMenu({ href }: { href: string }) {
  const pathname = hrefPathname(href);
  const repo = tabRepo(pathname);
  if (!repo) return null;
  const name = repo.split("/")[1] ?? repo;
  const current = tabSection(pathname);

  return (
    <>
      <nav
        aria-label={`${name} sections`}
        className={cn(
          "group/sections flex shrink-0 items-center gap-px rounded-lg p-0.5 transition-colors @max-[480px]:hidden",
          "hover:bg-[color-mix(in_oklab,var(--color-bg-sunken)_45%,transparent)]",
        )}
      >
        {SECTIONS.map((s) => {
          const on = s.id === current;
          const Icon = s.icon;
          return (
            <Tooltip key={s.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={`${name} ${s.label}`}
                  aria-current={on ? "page" : undefined}
                  onClick={() => openInNewTab(`/${repo}${s.suffix}`)}
                  className={cn(
                    "flex h-6.5 items-center rounded-lg px-2 text-ui outline-none transition-colors",
                    "hover:bg-accent hover:text-foreground focus-visible:ring-1 focus-visible:ring-(--color-focus)",
                    on ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  <Icon aria-hidden size={14} className="shrink-0" />
                  <span
                    className={cn(
                      "overflow-hidden whitespace-nowrap @max-[620px]:hidden",
                      "transition-[max-width,opacity,margin] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
                      on
                        ? "ml-1.5 max-w-18 opacity-100"
                        : "ml-0 max-w-0 opacity-0 group-hover/sections:ml-1.5 group-hover/sections:max-w-18 group-hover/sections:opacity-100",
                    )}
                  >
                    {s.label}
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <span className="font-mono">{name}</span> · {s.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </nav>

      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`${name} sections`}
                className="hidden shrink-0 text-muted-foreground @max-[480px]:inline-flex"
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <span className="font-mono">{name}</span> sections
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuLabel className="truncate font-mono text-caption text-muted-foreground">
            {name}
          </DropdownMenuLabel>
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <DropdownMenuItem
                key={s.id}
                aria-current={s.id === current ? "page" : undefined}
                onSelect={() => openInNewTab(`/${repo}${s.suffix}`)}
                className={cn("text-ui", s.id === current && "text-foreground")}
              >
                <Icon aria-hidden size={14} />
                {s.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
