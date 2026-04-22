import { Check, Settings2 } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/app/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/app/components/ui/popover";
import { cn } from "@/app/lib/cn";

// ─── SidebarPicker ─────────────────────────────────────────────────────────
//
// Generic gear-popover picker used by the PR sidebar sections (Reviewers,
// Assignees, Labels). GitHub's sidebar toggles sections via a gear; we
// mirror that affordance.
//
// Shape:
//   <SidebarPicker
//     items={…}
//     selectedIds={Set}
//     onToggle={(id, next) => …}
//     placeholder="Filter…"
//     loading={isFetching}
//   />
//
// Items can render with a swatch (labels), avatar (users), or neither.
// Toggle is fire-and-update — consumers wire in optimistic mutations so
// the popover feels instant.

export type PickerItem = {
  id: string;
  label: string;
  description?: string | null;
  /** Hex color swatch for labels (no leading #). */
  color?: string;
  /** Avatar URL for users. */
  avatarUrl?: string;
};

export type SidebarPickerProps = {
  /** Title shown at the top of the popover (mirrors GitHub's "Assign up to …"). */
  title: string;
  items: PickerItem[];
  selectedIds: Set<string>;
  onToggle: (id: string, next: boolean) => void;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  loading?: boolean;
  /** Custom trigger; defaults to a gear button that sits next to the header. */
  trigger?: ReactNode;
  ariaLabel: string;
};

export function SidebarPicker({
  title,
  items,
  selectedIds,
  onToggle,
  placeholder = "Filter…",
  emptyText = "No matches",
  disabled,
  loading,
  trigger,
  ariaLabel,
}: SidebarPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.label.toLowerCase().includes(q) ||
        (i.description?.toLowerCase().includes(q) ?? false),
    );
  }, [items, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            aria-label={ariaLabel}
            disabled={disabled}
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
      <PopoverContent align="end" sideOffset={4} className="w-64 p-0">
        <div className="border-b border-border px-3 py-2 text-caption font-medium text-foreground">
          {title}
        </div>
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={placeholder}
          />
          <CommandList className="max-h-72">
            {loading ? (
              <div className="px-3 py-4 text-caption text-muted-foreground">
                Loading…
              </div>
            ) : filtered.length === 0 ? (
              <CommandEmpty>{emptyText}</CommandEmpty>
            ) : (
              <CommandGroup>
                {filtered.map((item) => {
                  const isSelected = selectedIds.has(item.id);
                  return (
                    <CommandItem
                      key={item.id}
                      value={item.id}
                      onSelect={() => onToggle(item.id, !isSelected)}
                      className="flex items-center gap-2"
                    >
                      <Check
                        className={cn(
                          "size-3.5 shrink-0",
                          isSelected ? "opacity-100" : "opacity-0",
                        )}
                        aria-hidden
                      />
                      {item.color && (
                        <span
                          aria-hidden
                          className="size-3 shrink-0 rounded-full border border-black/10"
                          style={{ backgroundColor: `#${item.color}` }}
                        />
                      )}
                      {item.avatarUrl && (
                        <img
                          src={item.avatarUrl}
                          alt=""
                          className="size-4 shrink-0 rounded-full"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-caption font-medium text-foreground">
                          {item.label}
                        </div>
                        {item.description && (
                          <div className="truncate text-micro text-muted-foreground">
                            {item.description}
                          </div>
                        )}
                      </div>
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
