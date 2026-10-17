import { type ReactNode, useLayoutEffect, useRef } from "react";
import { IslandSwitcher } from "@/app/components/shell/IslandSwitcher";
import { RecentVisits } from "@/app/components/shell/RecentVisits";
import { Sidebar, SidebarContent } from "@/app/components/shell/Sidebar";
import { useDocking } from "@/app/components/shell/useDocking";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/app/components/ui/sheet";
import { NotificationsSync } from "@/app/features/notifications/NotificationsSync";
import { useKeybindings } from "@/app/hooks/useKeybindings";
import { focusPaneOfFocusedTab } from "@/app/lib/tabActions";
import { SIDEBAR_RAIL_WIDTH, useSidebarStore } from "@/app/stores/sidebar";
import { useWorkspaceView } from "@/app/stores/workspaceView";
import { useWorkspaceStore } from "@/app/workspace/store";
import { isNarrowLayout } from "@/app/workspace/view";

/** Sidebar launchers and island headers share one drag interaction and target set. */
export function WorkspaceArea({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const launched = useRef(false);
  const { narrow, sidebarOpen, setNarrow, setSidebarOpen, toggleSidebar } = useWorkspaceView();
  const layout = useWorkspaceStore((state) => state.workspace.layout);
  const { width, collapsed } = useSidebarStore();
  const closeAfterLaunch = () => {
    launched.current = true;
    setSidebarOpen(false);
  };
  const docking = useDocking(ref, {
    onDragStart: () => {
      if (narrow) closeAfterLaunch();
    },
  });
  useKeybindings({ "⌘b": toggleSidebar });
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () =>
      setNarrow(
        isNarrowLayout(layout, {
          width: element.clientWidth,
          height: element.clientHeight,
          viewportWidth: window.innerWidth,
          sidebarWidth: collapsed ? SIDEBAR_RAIL_WIDTH : width,
        }),
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [layout, width, collapsed, setNarrow]);
  return (
    <div
      ref={ref}
      data-workspace-area
      data-narrow={narrow}
      onPointerDownCapture={docking.onPointerDown}
      className="relative flex min-h-0 flex-1"
    >
      <RecentVisits />
      <NotificationsSync />
      {narrow ? (
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent
            id="workspace-sidebar"
            side="left"
            className="w-80 max-w-[calc(100vw-2rem)] p-4"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              if (launched.current) {
                launched.current = false;
                focusPaneOfFocusedTab();
              } else document.querySelector<HTMLButtonElement>("[data-sidebar-toggle]")?.focus();
            }}
          >
            <SheetHeader className="pr-8 pb-4">
              <SheetTitle>Sidebar</SheetTitle>
              <SheetDescription className="sr-only">
                Open your work, starred repositories and recent pages.
              </SheetDescription>
            </SheetHeader>
            <SidebarContent beginDrag={docking.beginDrag} onLaunch={closeAfterLaunch} />
          </SheetContent>
        </Sheet>
      ) : (
        <Sidebar beginDrag={docking.beginDrag} />
      )}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {narrow && <IslandSwitcher />}
        {children}
      </div>
      {docking.overlay}
    </div>
  );
}
