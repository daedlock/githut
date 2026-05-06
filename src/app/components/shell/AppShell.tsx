import type { ReactNode } from "react";
import { cn } from "@/app/lib/cn";

export type AppShellProps = {
  header: ReactNode;
  children: ReactNode;
  className?: string;
  /**
   * When false, the header slot scrolls with the page instead of sticking.
   * Useful on routes that have their own sticky bar inside the content
   * (e.g. commit diff view), where double-stacking wastes vertical space.
   * Default: true.
   */
  stickyHeader?: boolean;
};

export function AppShell({ header, children, className, stickyHeader = true }: AppShellProps) {
  return (
    <div className={cn("flex min-h-full flex-col", className)}>
      {/*
       * Sticky header stack. UnifiedNav sticks at the top of the viewport
       * when the page scrolls. z-40 sits above page content but below modals.
       */}
      <div className={cn("bg-background", stickyHeader && "sticky top-0 z-40")}>{header}</div>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
