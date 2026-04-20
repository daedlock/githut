import { ChevronDown } from "lucide-react";
import { cn } from "@/app/lib/cn";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";

export function WorkspaceSwitcher() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Switch workspace"
          className={cn(
            "inline-flex items-center gap-1 rounded-[var(--radius-sm)] px-2 py-1",
            "font-mono text-ui text-[var(--color-fg)]",
            "transition-colors hover:bg-[var(--color-bg-subtle)]",
            "data-[state=open]:bg-[var(--color-bg-subtle)]",
          )}
        >
          <span>All repos</span>
          <ChevronDown className="h-3.5 w-3.5 text-[var(--color-fg-muted)]" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className={cn(
          "min-w-[180px] overflow-hidden rounded-[var(--radius-md)]",
          "border border-[var(--color-border-strong)] bg-[var(--color-bg)]",
          "shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(0,0,0,0.2)]",
          "w-auto gap-0 p-1",
        )}
      >
        <div className="px-3 pb-1 pt-0.5 font-mono text-micro uppercase tracking-widest text-[var(--color-fg-faint)]">
          Workspaces
        </div>
        <div
          aria-current="true"
          className={cn(
            "flex items-center justify-between px-3 py-1.5 font-mono text-ui",
            "text-[var(--color-fg)] bg-[var(--color-bg-subtle)]",
          )}
        >
          <span>All repos</span>
          <span className="text-micro text-[var(--color-fg-faint)]">current</span>
        </div>
        <div className="mt-1 border-t border-[var(--color-border)] px-3 py-2 font-sans text-caption text-[var(--color-fg-faint)]">
          Pinned workspaces coming soon.
        </div>
      </PopoverContent>
    </Popover>
  );
}
