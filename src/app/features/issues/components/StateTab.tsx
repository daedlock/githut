import { CheckCircle2, CircleDot } from "lucide-react";
import { cn } from "@/app/lib/cn";

export type StateFilter = "open" | "closed";

export function StateTab({
  state,
  count,
  isActive,
  onClick,
}: {
  state: StateFilter;
  count: number;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-2 text-body rounded-sm",
        "outline-none transition-colors",
        "focus-visible:ring-1 focus-visible:ring-foreground/15",
        isActive
          ? "font-semibold text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {state === "open" ? (
        <CircleDot
          className={cn(
            "size-4",
            isActive ? "text-[var(--color-success)]" : "text-[var(--color-fg-faint)]",
          )}
        />
      ) : (
        <CheckCircle2
          className={cn(
            "size-4",
            isActive ? "text-muted-foreground" : "text-[var(--color-fg-faint)]",
          )}
        />
      )}
      <span className="tabular-nums">{count}</span>
      <span className="capitalize">{state}</span>
    </button>
  );
}
