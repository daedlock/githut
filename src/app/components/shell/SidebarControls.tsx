import { PanelLeft, Search } from "lucide-react";
import { UserMenu } from "@/app/components/shell/UserMenu";
import { Button } from "@/app/components/ui/button";
import { Kbd } from "@/app/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import { useMe } from "@/app/hooks/useMe";
import { logout, manageGitHubAccess } from "@/app/lib/auth";
import { cn } from "@/app/lib/cn";
import { useCommandPalette } from "@/app/stores/commandPalette";
import { useSidebarStore } from "@/app/stores/sidebar";
import { useWorkspaceView } from "@/app/stores/workspaceView";

const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform);

/**
 * Global controls stay in the sidebar; the islands own the entire adjacent
 * area. The top row is `h-10` in both states, so Inbox and every row below
 * keep their position when the sidebar collapses: the rail keeps only the
 * toggle on top and moves search and account to its foot (`SidebarRailFooter`).
 */
export function SidebarControls({
  collapsed = false,
  drawer = false,
}: {
  collapsed?: boolean;
  drawer?: boolean;
}) {
  return (
    <div
      data-link-menu="off"
      className={cn(
        "flex h-10 shrink-0 items-center gap-1",
        collapsed ? "justify-center" : "px-1",
        drawer && "pr-6",
      )}
    >
      {!drawer && <SidebarToggle />}
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1 truncate text-ui font-medium">GitHut</span>
          <GlobalControls drawer={drawer} />
        </>
      )}
    </div>
  );
}

/** Search and account at the bottom of the collapsed rail. */
export function SidebarRailFooter() {
  return (
    <div data-link-menu="off" className="flex shrink-0 flex-col items-center gap-1 py-2">
      <GlobalControls />
    </div>
  );
}

function GlobalControls({ drawer = false }: { drawer?: boolean }) {
  const { data: me } = useMe();
  const { open: openSearch } = useCommandPalette();
  const setSidebarOpen = useWorkspaceView((state) => state.setSidebarOpen);
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Search or jump to"
            aria-keyshortcuts={mac ? "Meta+K" : "Control+K"}
            onClick={() => {
              if (drawer) setSidebarOpen(false);
              openSearch();
            }}
          >
            <Search />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          Search or jump to <Kbd>{mac ? "⌘K" : "Ctrl K"}</Kbd>
        </TooltipContent>
      </Tooltip>
      <UserMenu
        login={me?.login}
        avatarUrl={me?.avatar_url}
        onSignOut={logout}
        onReAuth={manageGitHubAccess}
        onNavigate={drawer ? () => setSidebarOpen(false) : undefined}
      />
    </>
  );
}

export function SidebarToggle() {
  const collapsed = useSidebarStore((state) => state.collapsed);
  const { narrow, sidebarOpen, toggleSidebar } = useWorkspaceView();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          data-sidebar-toggle
          // Open is the resting state here, not a pressed one.
          className="aria-expanded:bg-transparent aria-expanded:text-muted-foreground aria-expanded:hover:bg-muted aria-expanded:hover:text-foreground"
          aria-label={narrow ? "Open sidebar" : collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={narrow ? sidebarOpen : !collapsed}
          aria-controls="workspace-sidebar"
          aria-keyshortcuts={mac ? "Meta+B" : "Control+B"}
          onClick={toggleSidebar}
        >
          <PanelLeft />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        Toggle sidebar <Kbd>{mac ? "⌘B" : "Ctrl B"}</Kbd>
      </TooltipContent>
    </Tooltip>
  );
}
