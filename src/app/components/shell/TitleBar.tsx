import { GitBranch, Search } from "lucide-react";

import { RepoMark } from "@/app/components/shell/RepoMark";
import { UserMenu } from "@/app/components/shell/UserMenu";
import { Kbd } from "@/app/components/ui/kbd";
import { Skeleton } from "@/app/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import { useMe } from "@/app/hooks/useMe";
import { useRepo } from "@/app/hooks/useRepo";
import { logout, manageGitHubAccess } from "@/app/lib/auth";
import { cn } from "@/app/lib/cn";
import { openInNewTab } from "@/app/lib/tabActions";
import { getTabMeta, tabRepo } from "@/app/lib/tabMeta";
import { useCommandPalette } from "@/app/stores/commandPalette";
import { hrefPathname } from "@/app/stores/tabs";

// ─── TitleBar ──────────────────────────────────────────────────────────────
//
// The slim window bar on the frame, above the islands. It is global chrome,
// not part of any tab:
//
//   [logo] [repo mark owner/repo  ⎇ branch] ── [Search or jump to… ⌘K] ── [avatar]
//
// The context names the focused tab's repo and branch, so you always know
// where actions land. App-wide pages (dashboard, profile) show their label.

const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform);

export function TitleBar({ focusedHref }: { focusedHref: string | null }) {
  const { data: me, isPending: mePending } = useMe();

  return (
    <header
      data-link-menu="off"
      className={cn(
        "grid h-11 shrink-0 select-none items-center gap-x-2",
        "grid-cols-[auto_minmax(0,1fr)_auto_auto] md:grid-cols-[auto_minmax(0,1fr)_minmax(0,420px)_minmax(0,1fr)]",
      )}
    >
      <LogoButton />
      {focusedHref ? <FocusedContext href={focusedHref} /> : <span />}
      <SearchTrigger />
      <div className="flex min-w-0 items-center justify-end gap-1.5">
        {mePending && <Skeleton className="size-7 shrink-0 rounded-full" />}
        {me && (
          <UserMenu
            login={me.login}
            avatarUrl={me.avatar_url}
            onSignOut={logout}
            onReAuth={manageGitHubAccess}
            variant="compact"
          />
        )}
      </div>
    </header>
  );
}

function LogoButton() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Open dashboard"
          onClick={() => openInNewTab("/")}
          className={cn(
            "inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-foreground",
            "outline-none transition-colors hover:bg-accent focus-visible:ring-1 focus-visible:ring-(--color-focus)",
          )}
        >
          <svg width="20" height="20" viewBox="0 0 100 100" aria-hidden="true">
            <path
              fillRule="evenodd"
              fill="currentColor"
              d="M50 4 A46 46 0 1 1 50 96 A46 46 0 1 1 50 4 Z M54 32 L67 43 Q71 47 71 52 L71 62 Q71 68 65 68 L35 68 Q29 68 29 62 L29 52 Q29 47 33 43 L46 32 Q50 28 54 32 Z"
            />
          </svg>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">Dashboard</TooltipContent>
    </Tooltip>
  );
}

// ─── Focused tab context ───────────────────────────────────────────────────

function FocusedContext({ href }: { href: string }) {
  const pathname = hrefPathname(href);
  const repo = tabRepo(pathname);

  if (!repo) {
    const meta = getTabMeta(pathname);
    const Icon = meta.icon;
    return (
      <div
        aria-live="polite"
        className="flex min-w-0 items-center gap-2 pl-1 text-ui text-muted-foreground"
      >
        <Icon aria-hidden className="size-3.5 shrink-0 text-(--color-fg-faint)" />
        <span className="truncate">{meta.label}</span>
      </div>
    );
  }

  const [owner = "", name = ""] = repo.split("/");
  return (
    <div aria-live="polite" className="flex min-w-0 items-center gap-2 whitespace-nowrap pl-1">
      <RepoMark repo={repo} />
      <span className="min-w-0 truncate font-mono text-ui">
        <span className="text-muted-foreground">{owner}</span>
        <span className="mx-0.5 text-(--color-fg-faint)">/</span>
        <span className="text-foreground">{name}</span>
      </span>
      <BranchLabel owner={owner} repo={name} href={href} />
    </div>
  );
}

/** The branch the URL names (code view), else the repo's default branch. */
function BranchLabel({ owner, repo, href }: { owner: string; repo: string; href: string }) {
  const fromUrl = new URLSearchParams(href.split("?")[1]?.split("#")[0]).get("branch");
  const { data } = useRepo(owner, repo);
  const branch = fromUrl ?? data?.default_branch;
  if (!branch) return null;
  return (
    <span className="hidden min-w-0 items-center gap-1 text-caption text-muted-foreground sm:inline-flex">
      <GitBranch aria-hidden className="size-3.5 shrink-0" />
      <span className="truncate font-mono">{branch}</span>
    </span>
  );
}

// ─── Search ────────────────────────────────────────────────────────────────

function SearchTrigger() {
  const { open } = useCommandPalette();
  return (
    <button
      type="button"
      onClick={open}
      aria-label="Search or jump to"
      aria-keyshortcuts={mac ? "Meta+K" : "Control+K"}
      className={cn(
        "inline-flex h-7 min-w-0 items-center gap-2 rounded-lg bg-muted text-muted-foreground",
        "shadow-(--island-shadow) outline-none transition-colors",
        "hover:text-foreground focus-visible:ring-1 focus-visible:ring-(--color-focus)",
        "w-7 justify-center md:w-full md:justify-start md:px-2",
      )}
    >
      <Search aria-hidden className="size-3.5 shrink-0" />
      <span className="hidden flex-1 truncate text-left text-caption md:inline">
        Search or jump to…
      </span>
      <Kbd className="hidden bg-background md:inline-flex">{mac ? "⌘K" : "Ctrl K"}</Kbd>
    </button>
  );
}
