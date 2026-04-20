import {
  autoUpdate,
  FloatingPortal,
  flip,
  offset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
} from "@floating-ui/react";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/app/lib/cn";

/**
 * Workspace switcher — STUB for P1.T1.a.
 *
 * Real impl (P5.B3) will surface the user's pinned workspaces. For now the
 * popover lists a single disabled "All repos" entry so the control reads as
 * intentionally-placeholder rather than broken.
 *
 * Chip-style trigger per §3: mono font for the workspace name (technical
 * identifier), subtle chevron, no background until hover.
 */
export function WorkspaceSwitcher() {
  const [open, setOpen] = useState(false);

  const { refs, floatingStyles, context, placement } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: "bottom-start",
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
    middleware: [offset(4), flip({ padding: 8 }), shift({ padding: 8 })],
  });

  const click = useClick(context);
  const dismiss = useDismiss(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss]);

  return (
    <>
      <button
        ref={refs.setReference}
        type="button"
        aria-label="Switch workspace"
        className={cn(
          "inline-flex items-center gap-1 rounded-[var(--radius-sm)] px-2 py-1",
          "font-mono text-ui text-[var(--color-fg)]",
          "transition-colors hover:bg-[var(--color-bg-subtle)]",
          open && "bg-[var(--color-bg-subtle)]",
        )}
        {...getReferenceProps()}
      >
        <span>All repos</span>
        <ChevronDown className="h-3.5 w-3.5 text-[var(--color-fg-muted)]" aria-hidden />
      </button>

      {open ? (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={{ ...floatingStyles, zIndex: 60 }}
            data-placement={placement}
            className={cn(
              "popover-enter",
              "min-w-[180px] overflow-hidden rounded-[var(--radius-md)]",
              "border border-[var(--color-border-strong)] bg-[var(--color-bg)]",
              "shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(0,0,0,0.2)]",
              "py-1",
            )}
            {...getFloatingProps()}
          >
            {/* Eyebrow — marks this section as "workspaces" without leaning
                on a header row. Uppercase tracking per §6. */}
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
          </div>
        </FloatingPortal>
      ) : null}
    </>
  );
}
