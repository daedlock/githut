import { Check, Minus, Settings2 } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/app/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import { cn } from "@/app/lib/cn";
import { useCanMutate } from "@/app/lib/connectivity";

const SKELETON_WIDTHS = ["50%", "67%", "84%", "66%"] as const;

export type PickerItem = {
  id: string;
  label: string;
  description?: string | null;
  color?: string;
  avatarUrl?: string;
  icon?: ReactNode;
};

export type SidebarPickerProps = {
  title: string;
  items: PickerItem[];
  selectedIds: ReadonlySet<string>;
  /** Items only some of the targets have (bulk edits); shown with a dash. */
  mixedIds?: ReadonlySet<string>;
  onToggle: (id: string, next: boolean) => void;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  loading?: boolean;
  trigger?: ReactNode;
  ariaLabel: string;
  onQueryChange?: (query: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  closeOnSelect?: boolean;
  side?: "top" | "bottom";
  align?: "start" | "center" | "end";
};

export function SidebarPicker({
  title,
  items,
  selectedIds,
  mixedIds,
  onToggle,
  placeholder = "Filter…",
  emptyText = "No matches",
  disabled,
  loading,
  trigger,
  ariaLabel,
  onQueryChange,
  open: controlledOpen,
  onOpenChange,
  closeOnSelect,
  side = "bottom",
  align = "end",
}: SidebarPickerProps) {
  const { canMutate, reason } = useCanMutate();
  const unavailable = disabled || !canMutate;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = (controlledOpen ?? uncontrolledOpen) && !unavailable;
  const [query, setQuery] = useState("");

  function updateQuery(next: string) {
    setQuery(next);
    onQueryChange?.(next);
  }

  function updateOpen(next: boolean) {
    if (next && unavailable) return;
    setUncontrolledOpen(next);
    onOpenChange?.(next);
    if (!next) updateQuery("");
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.label.toLowerCase().includes(q) || (i.description?.toLowerCase().includes(q) ?? false),
    );
  }, [items, query]);

  return (
    <Popover open={open} onOpenChange={updateOpen}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            aria-label={ariaLabel}
            disabled={unavailable}
            title={reason}
            className={cn(
              "inline-flex size-5 items-center justify-center rounded-sm",
              "text-[var(--color-fg-faint)] outline-none transition-colors",
              "hover:bg-[var(--color-bg-sunken)] hover:text-foreground",
              "focus-visible:bg-[var(--color-bg-sunken)] focus-visible:text-foreground",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            <Settings2 className="size-3.5" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        sideOffset={side === "top" ? 8 : 4}
        className="w-56 p-0"
      >
        <Command shouldFilter={false}>
          <div className="p-1.5">
            <input
              value={query}
              onChange={(e) => updateQuery(e.target.value)}
              placeholder={placeholder}
              aria-label={title}
              className={cn(
                "w-full rounded-md bg-[var(--color-popover-active)] px-2.5 py-1.5",
                "text-caption text-foreground placeholder:text-muted-foreground",
                "outline-none",
              )}
            />
          </div>
          <CommandList className="max-h-64 px-1.5 pb-1.5">
            {loading ? (
              <div className="flex flex-col gap-0.5">
                {SKELETON_WIDTHS.map((width) => (
                  <div key={width} className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
                    <div className="size-5 animate-pulse rounded-full bg-muted" />
                    <div className="h-2.5 animate-pulse rounded bg-muted" style={{ width }} />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <CommandEmpty>{emptyText}</CommandEmpty>
            ) : (
              <CommandGroup>
                {filtered.map((item) => {
                  const isSelected = selectedIds.has(item.id);
                  const isMixed = !isSelected && !!mixedIds?.has(item.id);
                  return (
                    <CommandItem
                      key={item.id}
                      value={item.id}
                      style={{ contentVisibility: "auto", containIntrinsicSize: "auto 32px" }}
                      data-checked={isSelected ? "true" : isMixed ? "mixed" : "false"}
                      onSelect={() => {
                        if (unavailable) return;
                        onToggle(item.id, !isSelected);
                        if (closeOnSelect) updateOpen(false);
                      }}
                      className="gap-2.5 px-2 py-1.5"
                      disabled={unavailable}
                    >
                      {item.icon ? (
                        <span
                          aria-hidden
                          className="flex size-5 shrink-0 items-center justify-center"
                        >
                          {item.icon}
                        </span>
                      ) : item.color ? (
                        <span
                          aria-hidden
                          className="size-3 shrink-0 rounded-full ring-1 ring-inset ring-black/10 dark:ring-white/10"
                          style={{ backgroundColor: `#${item.color}` }}
                        />
                      ) : item.avatarUrl ? (
                        <img src={item.avatarUrl} alt="" className="size-5 shrink-0 rounded-full" />
                      ) : null}
                      <span className="min-w-0 flex-1 truncate text-caption">{item.label}</span>
                      {item.description && <span className="hidden" />}
                      {isMixed ? (
                        <Minus className="size-3 shrink-0 text-muted-foreground" aria-hidden />
                      ) : (
                        <Check
                          className={cn(
                            "size-3 shrink-0 transition-opacity duration-75",
                            isSelected ? "opacity-100 text-[var(--color-success)]" : "opacity-0",
                          )}
                          aria-hidden
                        />
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
