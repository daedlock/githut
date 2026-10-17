import {
  CodeIcon,
  GitCommitIcon,
  GitPullRequestIcon,
  IssueOpenedIcon,
  PlayIcon,
} from "@primer/octicons-react";
import { MoreHorizontal } from "lucide-react";
import { useRef } from "react";

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
import { focusPaneOfFocusedTab, openOrJump } from "@/app/lib/tabActions";
import { type RepoSection, tabRepo, tabSection } from "@/app/lib/tabMeta";
import { hrefPathname } from "@/app/workspace/model";

// ─── SectionMenu ───────────────────────────────────────────────────────────
//
// The repo sections (Code, Commits, PRs, Issues, Actions) in an island
// header. An island belongs to no repo, so they act on the island's selected
// tab's repo and say so in their labels.
//
// Static tiers decided by the island's width only (container queries), so
// nothing in the header moves on hover: labels while the island is wide,
// icons only at ≤760px, then one "⋯" menu at ≤480px, so tabs keep most of
// the header. Sections are launchers: they jump to an open tab showing the
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
  const launched = useRef(false);
  const pathname = hrefPathname(href);
  const repo = tabRepo(pathname);
  if (!repo) return null;
  const name = repo.split("/")[1] ?? repo;
  const current = tabSection(pathname);

  return (
    <>
      <nav
        aria-label={`${name} sections`}
        className="flex shrink-0 items-center gap-px @max-[480px]:hidden"
      >
        {SECTIONS.map((s) => {
          const on = s.id === current;
          const Icon = s.icon;
          return (
            <Tooltip key={s.id}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`${name} ${s.label}`}
                  aria-current={on ? "page" : undefined}
                  onClick={() => openOrJump(`/${repo}${s.suffix}`)}
                  className={cn(
                    "h-6.5 gap-1.5 px-2 font-normal text-ui @max-[760px]:px-1.5",
                    on && "bg-muted text-foreground",
                  )}
                >
                  <Icon aria-hidden size={14} />
                  <span className="@max-[760px]:hidden">{s.label}</span>
                </Button>
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
        <DropdownMenuContent
          align="end"
          className="w-44"
          onCloseAutoFocus={(event) => {
            if (!launched.current) return;
            launched.current = false;
            event.preventDefault();
            focusPaneOfFocusedTab();
          }}
        >
          <DropdownMenuLabel className="truncate font-mono text-caption text-muted-foreground">
            {name}
          </DropdownMenuLabel>
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <DropdownMenuItem
                key={s.id}
                aria-current={s.id === current ? "page" : undefined}
                onSelect={() => {
                  launched.current = true;
                  openOrJump(`/${repo}${s.suffix}`);
                }}
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
