import type { LucideIcon } from "lucide-react";
import { cn } from "@/app/lib/cn";

/**
 * A view switch in a list toolbar ("Open 8 · Closed 3"). The active tab takes
 * the active surface; weight never changes, so switching never shifts layout.
 */
export function ViewTab({
  icon: Icon,
  activeIconClassName,
  label,
  count,
  active,
  onClick,
}: {
  icon: LucideIcon;
  /** Icon color while active (usually a status color). */
  activeIconClassName?: string;
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-ui font-medium text-muted-foreground",
        "outline-none transition-colors hover:bg-accent/60 hover:text-foreground",
        "focus-visible:ring-1 focus-visible:ring-foreground/15",
        "aria-pressed:bg-accent aria-pressed:text-foreground",
      )}
    >
      <Icon
        aria-hidden
        className={cn("size-4", active ? activeIconClassName : "text-(--color-fg-faint)")}
      />
      {label}
      {count !== undefined && (
        <span className="text-caption font-normal tabular-nums text-muted-foreground">{count}</span>
      )}
    </button>
  );
}
