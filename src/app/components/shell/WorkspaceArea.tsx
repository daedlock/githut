import { type ReactNode, useRef } from "react";
import { RecentVisits } from "@/app/components/shell/RecentVisits";
import { Sidebar } from "@/app/components/shell/Sidebar";
import { useDocking } from "@/app/components/shell/useDocking";
import { NotificationsSync } from "@/app/features/notifications/NotificationsSync";

/** Sidebar launchers and island headers share one drag interaction and target set. */
export function WorkspaceArea({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const docking = useDocking(ref);
  return (
    <div
      ref={ref}
      data-workspace-area
      onPointerDownCapture={docking.onPointerDown}
      className="relative flex min-h-0 flex-1"
    >
      <RecentVisits />
      <NotificationsSync />
      <Sidebar beginDrag={docking.beginDrag} />
      {children}
      {docking.overlay}
    </div>
  );
}
