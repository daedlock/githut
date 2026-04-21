import type { ReactNode } from "react";
import { cn } from "@/app/lib/cn";
import { useNavVariantStore } from "@/app/stores/navVariant";

export type AppShellProps = {
  header: ReactNode;
  footer?: ReactNode;
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

/**
 * Shell layout. Default is `flex-col` (header on top, content fills below).
 *
 * When the `vertical-rail` nav variant is active, the layout flips to
 * `flex-row` so the rail becomes a left sidebar and content fills the
 * remaining viewport. Footer moves under the content column (not under
 * the rail) so the rail stays anchored top-to-bottom.
 */
export function AppShell({
  header,
  footer,
  children,
  className,
  stickyHeader = true,
}: AppShellProps) {
  const isVertical = useNavVariantStore((s) => s.variantId === "vertical-rail");

  if (isVertical) {
    // Vertical rail is already `sticky top-0 h-screen` in its own component,
    // so no extra wrapper needed here.
    return (
      <div className={cn("flex min-h-full flex-row", className)}>
        {header}
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="flex flex-1 flex-col">{children}</main>
          {footer}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex min-h-full flex-col", className)}>
      {/*
       * Sticky header stack. Everything passed in as `header` (TopBar, plus
       * optional sub-navs like RepoSubTabs on repo pages) sticks together
       * at the top of the viewport when the page scrolls. z-40 sits above
       * page content but below modals (z-50+).
       */}
      <div className={cn("bg-background", stickyHeader && "sticky top-0 z-40")}>{header}</div>
      <main className="flex flex-1 flex-col">{children}</main>
      {footer}
    </div>
  );
}
