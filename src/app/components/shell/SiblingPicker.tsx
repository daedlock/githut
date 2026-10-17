import { ChevronDown, CloudOff } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { Button } from "@/app/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/app/components/ui/command";
import { Kbd } from "@/app/components/ui/kbd";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import { Skeleton, SkeletonGroup } from "@/app/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import { cn } from "@/app/lib/cn";

// ─── SiblingPicker ─────────────────────────────────────────────────────────
//
// The filterable list behind a breadcrumb's chevron (and the branch chip):
// the crumb's siblings, opened on the current one. Keys follow links:
//   ↵ open here · ⇧↵ new tab · ⌥↵ to the side · Esc close
// Remote lists show Skeleton rows on first load, cached rows at once
// afterwards (their query refreshes silently), and the empty-state pattern
// with Retry when loading fails.

export type OpenMode = "here" | "tab" | "side";

export type PickerItem = {
  href: string;
  /** What filtering matches against. */
  text: string;
  /** Group heading (e.g. the repo owner); items keep their given order. */
  group?: string;
  content: ReactNode;
  current?: boolean;
};

export type PickerStatus = "ready" | "loading" | "error";

export type PickerData = { items: PickerItem[]; status: PickerStatus; onRetry?: () => void };

/** What a click or ↵ with these modifiers does, like a modified link click. */
export function openModeOf(e: { shiftKey: boolean; altKey: boolean }): OpenMode {
  return e.altKey ? "side" : e.shiftKey ? "tab" : "here";
}

export function SiblingPicker({
  label,
  placeholder,
  trigger,
  items,
  load,
  onPick,
}: {
  /** Accessible name of the chevron, e.g. "Switch section". */
  label: string;
  placeholder: string;
  /** Custom trigger (the branch chip); defaults to the crumb chevron. */
  trigger?: ReactNode;
  /** A static list… */
  items?: PickerItem[];
  /**
   * …or a remote one: a loader component that calls `render` with its data.
   * It mounts, and so fetches, only while the picker is open.
   */
  load?: (render: (data: PickerData) => ReactNode) => ReactNode;
  onPick: (href: string, mode: OpenMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tip, setTip] = useState(false);
  // Closing the picker returns focus to the trigger, which would open its
  // tooltip and leave it stuck there. Ignore that one focus; hovering or
  // tabbing back in shows the tooltip again.
  const returningFocus = useRef(false);
  const setPickerOpen = (next: boolean) => {
    if (!next) returningFocus.current = true;
    setTip(false);
    setOpen(next);
  };
  const pick = (href: string, mode: OpenMode) => {
    setPickerOpen(false);
    onPick(href, mode);
  };
  return (
    <Popover open={open} onOpenChange={setPickerOpen}>
      <Tooltip
        open={tip && !open}
        onOpenChange={(next) => setTip(next && !returningFocus.current)}
      >
        <TooltipTrigger
          asChild
          onPointerEnter={() => {
            returningFocus.current = false;
          }}
          onBlur={() => {
            returningFocus.current = false;
          }}
        >
          <PopoverTrigger asChild>
            {trigger ?? (
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={label}
                className="h-5.5 w-4.5 shrink-0 rounded-sm text-(--color-fg-faint) hover:bg-accent hover:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground [&_svg]:transition-transform data-[state=open]:[&_svg]:rotate-180"
              >
                <ChevronDown />
              </Button>
            )}
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">{label}</TooltipContent>
      </Tooltip>
      <PopoverContent align="start" className="w-80 gap-0 p-0">
        {load ? (
          load((data) => <PickerBody placeholder={placeholder} {...data} onPick={pick} />)
        ) : (
          <PickerBody placeholder={placeholder} items={items ?? []} status="ready" onPick={pick} />
        )}
      </PopoverContent>
    </Popover>
  );
}

function PickerBody({
  placeholder,
  items,
  status,
  onRetry,
  onPick,
}: {
  placeholder: string;
  items: PickerItem[];
  status: PickerStatus;
  onRetry?: () => void;
  onPick: (href: string, mode: OpenMode) => void;
}) {
  const current = items.find((i) => i.current)?.href ?? items[0]?.href ?? "";
  const [value, setValue] = useState(current);
  const mode = useRef<OpenMode>("here");
  const list = useRef<HTMLDivElement>(null);
  const ready = status === "ready" || items.length > 0;

  // Rows that arrive after opening start on the current one, so ↑/↓ moves
  // to its neighbours.
  const settled = useRef(false);
  useEffect(() => {
    if (!ready || settled.current || !current) return;
    settled.current = true;
    setValue(current);
    requestAnimationFrame(() =>
      list.current?.querySelector("[data-selected=true]")?.scrollIntoView({ block: "nearest" }),
    );
  }, [ready, current]);

  const groups = groupItems(items);
  const rememberMode = (e: { shiftKey: boolean; altKey: boolean }) => {
    mode.current = openModeOf(e);
    setTimeout(() => {
      mode.current = "here";
    });
  };

  return (
    <Command
      value={value}
      onValueChange={setValue}
      filter={(itemValue, search) => {
        const item = items.find((i) => i.href === itemValue);
        return item?.text.toLowerCase().includes(search.trim().toLowerCase()) ? 1 : 0;
      }}
      // ⇧/⌥ ride along with ↵ or the click into cmdk's onSelect. Reset after
      // cmdk's own handler has run.
      onKeyDownCapture={(e) => {
        if (e.key === "Enter" && !e.nativeEvent.isComposing) rememberMode(e);
      }}
      onClickCapture={rememberMode}
    >
      <CommandInput placeholder={placeholder} aria-label={placeholder} className="text-ui" />
      <CommandList ref={list} className="max-h-75">
        {!ready && status === "loading" && <PickerSkeleton />}
        {!ready && status === "error" && <PickerError onRetry={onRetry} />}
        {ready && (
          <>
            <CommandEmpty className="text-ui">No matches</CommandEmpty>
            {groups.map(([heading, rows]) => (
              <CommandGroup key={heading ?? ""} heading={heading}>
                {rows.map((item) => (
                  <CommandItem
                    key={item.href}
                    value={item.href}
                    aria-current={item.current ? "page" : undefined}
                    onSelect={() => onPick(item.href, mode.current)}
                    className="h-8 gap-2 py-0 text-ui aria-[current=page]:font-medium"
                  >
                    {item.content}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </>
        )}
      </CommandList>
      <div className="flex h-8 items-center gap-3 border-t border-border px-2.5 text-micro text-muted-foreground">
        <span className="flex items-center gap-1">
          <Kbd>↵</Kbd> open
        </span>
        <span className="flex items-center gap-1">
          <Kbd>⇧↵</Kbd> new tab
        </span>
        <span className="flex items-center gap-1">
          <Kbd>Alt ↵</Kbd> to the side
        </span>
      </div>
    </Command>
  );
}

function groupItems(items: PickerItem[]): [string | undefined, PickerItem[]][] {
  const groups = new Map<string | undefined, PickerItem[]>();
  for (const item of items) {
    const rows = groups.get(item.group);
    if (rows) rows.push(item);
    else groups.set(item.group, [item]);
  }
  return [...groups];
}

const SKELETON_WIDTHS = ["62%", "48%", "71%", "55%"] as const;

/** Mirrors a picker row: 16px icon slot, then the label. */
function PickerSkeleton() {
  return (
    <SkeletonGroup label="Loading" className="flex flex-col p-1">
      {SKELETON_WIDTHS.map((w) => (
        <div key={w} className="flex h-8 items-center gap-2 px-2">
          <Skeleton className="size-4" />
          <Skeleton className="h-3" style={{ width: w }} />
        </div>
      ))}
    </SkeletonGroup>
  );
}

/** DESIGN.md's empty-state pattern, with Retry. */
function PickerError({ onRetry }: { onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-4 py-6 text-center">
      <CloudOff aria-hidden className="size-5 text-(--color-fg-faint)" />
      <p className="text-body text-muted-foreground">Couldn't load this list.</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

/** Small helper for the label part of a row: truncating text that fills the row. */
export function PickerLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("min-w-0 flex-1 truncate", className)}>{children}</span>;
}
