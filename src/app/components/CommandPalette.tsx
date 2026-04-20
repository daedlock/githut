import * as Dialog from "@radix-ui/react-dialog";
import { useRouterState } from "@tanstack/react-router";
import { Command } from "cmdk";
import { useEffect, useRef } from "react";
import { cn } from "@/app/lib/cn";
import { useCommandPaletteStore } from "@/app/stores/commandPalette";

/**
 * Command palette — P1.G2 scope is the EMPTY SHELL.
 *
 * - Radix Dialog owns overlay, focus trap, Escape, and ARIA.
 * - cmdk owns the input + list semantics (arrow keys, loops, filtering)
 *   once P1.T1.b fills in the items.
 * - Motion: `palette-enter` keyframe in index.css (120ms cubic-out fade+scale).
 * - Close on route change is wired here because Radix can't know about the
 *   router; we watch the pathname and close when it changes while open.
 *
 * This shell renders a bordered panel with an input and an empty-state line.
 * No items, no sections, no actions — those are owned by P1.T1.b.
 */
export function CommandPalette() {
  const open = useCommandPaletteStore((s) => s.open);
  const setOpen = useCommandPaletteStore((s) => s.setOpen);

  // Close on route change. Subscribing to the full pathname (not just `location`
  // identity) avoids spurious closes on search-param updates from within the
  // palette's eventual content in P1.T1.b.
  //
  // We track the previous pathname via a ref so the effect only fires the
  // close on an actual pathname *transition*, not on the first mount. If we
  // included `open` in deps, opening the palette would immediately close it
  // again on the very next render; keeping the effect's dep list scoped to
  // pathname alone is intentional, and the `prevPath` ref carries the
  // detection without the linter-flagged closure problem.
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const prevPath = useRef(pathname);
  useEffect(() => {
    if (prevPath.current !== pathname) {
      prevPath.current = pathname;
      useCommandPaletteStore.getState().closePalette();
    }
  }, [pathname]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        {/*
         * Backdrop — subtle scrim. Uses a color-mix over --color-bg so the
         * overlay tint adapts to the active theme (warm in stone, graphite
         * in ember) without pulling in a raw rgba().
         */}
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-50",
            "bg-[color-mix(in_oklab,var(--color-fg)_32%,transparent)]",
            "backdrop-blur-[2px]",
            "[animation:palette-backdrop-in_120ms_cubic-bezier(0.16,1,0.3,1)]",
          )}
        />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            "fixed left-1/2 top-[22%] z-50",
            "w-[min(640px,calc(100vw-2rem))]",
            "-translate-x-1/2 -translate-y-1/2",
            "overflow-hidden rounded-[var(--radius-lg)]",
            "border border-[var(--color-border-strong)] bg-[var(--color-bg)]",
            // Same 2-layer shadow pattern used on the CommentBox popover — a
            // tight ring + a soft drop. No decorative glow.
            "shadow-[0_1px_0_rgba(0,0,0,0.04),0_12px_32px_-12px_rgba(0,0,0,0.22)]",
            "[animation:palette-enter_120ms_cubic-bezier(0.16,1,0.3,1)]",
            "focus:outline-none",
          )}
        >
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>

          <Command label="Command palette" className="flex flex-col">
            {/*
             * Input row — hairline bottom border marks it off from the results
             * list. `text-body` per §6 type-scale rules (this is a primary
             * typed-in control, not a UI chip).
             */}
            <div className="flex items-center border-b border-[var(--color-border)] px-4">
              <Command.Input
                autoFocus
                placeholder="Type a command or search…"
                className={cn(
                  "w-full bg-transparent py-3 text-body text-[var(--color-fg)]",
                  "placeholder:text-[var(--color-fg-faint)]",
                  "focus:outline-none",
                )}
              />
            </div>

            {/*
             * Results list — intentionally empty in P1.G2. cmdk's <Empty />
             * renders when there are zero matching items, which is always
             * true until P1.T1.b adds <Command.Item>s. The placeholder hint
             * uses --text-ui + fg-faint so it recedes without disappearing.
             */}
            <Command.List className="max-h-[360px] overflow-y-auto px-2 py-2">
              <Command.Empty
                className={cn("px-3 py-6 text-center text-ui text-[var(--color-fg-faint)]")}
              >
                No results.
              </Command.Empty>
            </Command.List>

            {/*
             * Footer hint strip — section label styling reserved for
             * eyebrows, used here to mark the palette's keyboard hint.
             * Hairline top border keeps the visual rhythm with the input row.
             */}
            <div
              className={cn(
                "flex items-center justify-between border-t border-[var(--color-border)]",
                "bg-[var(--color-bg-subtle)] px-3 py-2",
              )}
            >
              <span className="font-mono text-micro uppercase tracking-widest text-[var(--color-fg-faint)]">
                Command palette
              </span>
              <span className="font-mono text-micro uppercase tracking-widest text-[var(--color-fg-faint)]">
                Esc to close
              </span>
            </div>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
