import type { ReactNode } from "react";
import { cn } from "@/app/lib/cn";

/**
 * The toolbar every list page starts with: view controls on the left (state
 * tabs or the view name and count), search · filter · display · primary
 * action on the right. Controls inside are h-7 (`size="sm"`).
 */
export function ListToolbar({
  start,
  end,
  className,
}: {
  start: ReactNode;
  end?: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-surface="raised"
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted p-2",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-1">{start}</div>
      {end && <div className="flex flex-wrap items-center gap-2">{end}</div>}
    </div>
  );
}

/** View name and count for list pages without state tabs. */
export function ListToolbarTitle({ children, count }: { children: ReactNode; count?: number }) {
  return (
    <span className="flex items-center gap-2 px-2 text-ui font-medium text-foreground">
      {children}
      {count !== undefined && (
        <span className="text-caption font-normal tabular-nums text-muted-foreground">{count}</span>
      )}
    </span>
  );
}
