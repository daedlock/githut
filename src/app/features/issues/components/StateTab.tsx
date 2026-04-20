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
        "inline-flex items-center gap-1.5 px-3 py-2 text-body transition-colors",
        isActive
          ? "font-semibold text-[var(--color-fg)]"
          : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]",
      )}
    >
      {state === "open" ? (
        <CircleDot
          className={cn(
            "h-4 w-4",
            isActive ? "text-[var(--color-success)]" : "text-[var(--color-fg-faint)]",
          )}
        />
      ) : (
        <CheckCircle2
          className={cn(
            "h-4 w-4",
            isActive ? "text-[var(--color-fg-muted)]" : "text-[var(--color-fg-faint)]",
          )}
        />
      )}
      <span>{count}</span>
      <span className="capitalize">{state}</span>
    </button>
  );
}
