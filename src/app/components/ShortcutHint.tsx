import type { ComponentProps, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Kbd } from "@/app/components/ui/kbd";
import { Tooltip, TooltipContent } from "@/app/components/ui/tooltip";
import { platformKey } from "@/app/lib/platform";

/**
 * Tooltip state for a popover or picker trigger: hidden while the popover is
 * open, and quiet for a moment after it closes, so the focus that returns to
 * the trigger doesn't pop the tooltip.
 */
export function useTriggerTooltip(popoverOpen: boolean) {
  const [open, setOpen] = useState(false);
  const quietUntil = useRef(0);
  useEffect(() => {
    if (!popoverOpen) quietUntil.current = Date.now() + 300;
  }, [popoverOpen]);
  return {
    open: open && !popoverOpen,
    onOpenChange: (next: boolean) => setOpen(next && Date.now() > quietUntil.current),
  };
}

/**
 * A control's tooltip: its label plus its keyboard shortcut as key caps.
 * Children must include a `TooltipTrigger asChild` around the control. Pass
 * `suppressed` while a popover the control opens is showing.
 */
export function ShortcutHint({
  label,
  shortcut,
  suppressed = false,
  side,
  sideOffset,
  children,
}: {
  label: ReactNode;
  /** Space-separated keys, e.g. "L" or "⌘ Enter"; ⌘ renders as Ctrl off macOS. */
  shortcut?: string;
  suppressed?: boolean;
  side?: ComponentProps<typeof TooltipContent>["side"];
  sideOffset?: number;
  children: ReactNode;
}) {
  const tooltip = useTriggerTooltip(suppressed);
  return (
    <Tooltip {...tooltip}>
      {children}
      <TooltipContent side={side} sideOffset={sideOffset}>
        {label}
        {shortcut && (
          <span className="flex items-center gap-0.5">
            {shortcut.split(" ").map((key) => (
              <Kbd key={key}>{platformKey(key)}</Kbd>
            ))}
          </span>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
