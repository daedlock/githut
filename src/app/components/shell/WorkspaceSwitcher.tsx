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
            "inline-flex items-center gap-1 rounded-md px-2 py-1",
            "font-mono text-ui text-foreground",
            "outline-none transition-colors",
            "hover:bg-muted data-[state=open]:bg-muted",
            "focus-visible:bg-muted focus-visible:ring-1 focus-visible:ring-foreground/15",
          )}
        >
          <span>All repos</span>
          <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-auto min-w-[200px] gap-0 overflow-hidden p-1"
      >
        <div className="px-3 pb-1 pt-0.5 font-mono text-micro uppercase tracking-widest text-[var(--color-fg-faint)]">
          Workspaces
        </div>
        <div
          aria-current="true"
          className={cn(
            "flex items-center justify-between rounded-sm px-2.5 py-1.5",
            "font-mono text-ui text-foreground bg-[var(--color-bg-sunken)]",
          )}
        >
          <span>All repos</span>
          <span className="text-micro uppercase tracking-widest text-muted-foreground">
            current
          </span>
        </div>
        <div className="mt-1 border-t border-border px-3 py-2 font-sans text-caption text-[var(--color-fg-faint)]">
          Pinned workspaces coming soon.
        </div>
      </PopoverContent>
    </Popover>
  );
}
