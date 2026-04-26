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
  const Icon = state === "open" ? CircleDot : CheckCircle2;
  const activeIconTone =
    state === "open" ? "text-[var(--color-success)]" : "text-muted-foreground";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1.5 text-caption rounded-md",
        "outline-none transition-colors",
        "focus-visible:ring-1 focus-visible:ring-foreground/15",
        isActive
          ? "font-semibold text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon
        className={cn(
          "size-4",
          isActive ? activeIconTone : "text-[var(--color-fg-faint)]",
        )}
      />
      <span className="tabular-nums">{count}</span>
      <span className="capitalize">{state}</span>
    </button>
  );
}
