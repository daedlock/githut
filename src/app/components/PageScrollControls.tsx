import { ArrowDownToLine, ArrowUpToLine } from "lucide-react";
import { type RefObject, useEffect, useRef, useState } from "react";
import { Button } from "@/app/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/app/components/ui/tooltip";
import { cn } from "@/app/lib/cn";

/** Scroll-to-top/bottom affordances for one tab pane (its own scroll container). */
export function PageScrollControls({
  scrollerRef,
}: {
  scrollerRef: RefObject<HTMLElement | null>;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [canScrollToTop, setCanScrollToTop] = useState(false);
  const [canScrollToBottom, setCanScrollToBottom] = useState(false);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const updateTopVisibility = () => setCanScrollToTop(scroller.scrollTop > 0);
    updateTopVisibility();
    scroller.addEventListener("scroll", updateTopVisibility, { passive: true });
    return () => scroller.removeEventListener("scroll", updateTopVisibility);
  }, [scrollerRef]);

  useEffect(() => {
    const bottom = bottomRef.current;
    if (!bottom) return;

    // Watching the page end also handles navigation, late content, and resizing.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) setCanScrollToBottom(!entry.isIntersecting);
      },
      { root: scrollerRef.current, rootMargin: "0px 0px 96px 0px" },
    );
    observer.observe(bottom);
    return () => observer.disconnect();
  }, [scrollerRef]);

  function scrollTo(direction: "top" | "bottom") {
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : "smooth";
    if (direction === "top") {
      scrollerRef.current?.scrollTo({ top: 0, behavior });
    } else {
      bottomRef.current?.scrollIntoView({ behavior, block: "end" });
    }
  }

  return (
    <>
      <div ref={bottomRef} aria-hidden="true" className="pointer-events-none -mt-px h-px w-px" />
      <TooltipProvider delayDuration={400}>
        {/* Pinned to this pane's corner, not the viewport, so it never floats
            over another island. Row actions sit in the same corner of list
            rows: the buttons step aside while a row is hovered or focused, and
            where actions always show (no hover), they stay hidden. On narrow
            screens, a list's bulk action bar needs this corner. */}
        <div className="pointer-events-none sticky bottom-0 z-30 h-0">
          <div
            className={cn(
              "absolute right-[max(1rem,env(safe-area-inset-right))] bottom-[calc(1rem+env(safe-area-inset-bottom))] flex flex-col gap-2 motion-safe:transition-opacity",
              "max-sm:[body:has([data-bulk-bar])_&]:hidden",
              "[[data-tab-pane]:has([data-bulk-row]:focus-within)_&]:invisible [[data-tab-pane]:has([data-bulk-row]:focus-within)_&]:opacity-0 [[data-tab-pane]:has([data-bulk-row]:hover)_&]:invisible [[data-tab-pane]:has([data-bulk-row]:hover)_&]:opacity-0",
              "[@media(hover:none)]:[[data-tab-pane]:has([data-bulk-row])_&]:hidden",
            )}
          >
            {[
              { direction: "top" as const, visible: canScrollToTop, Icon: ArrowUpToLine },
              { direction: "bottom" as const, visible: canScrollToBottom, Icon: ArrowDownToLine },
            ].map(({ direction, visible, Icon }) => (
              <div key={direction} className="size-9">
                {visible && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-lg"
                        aria-label={`Scroll to ${direction}`}
                        onClick={() => scrollTo(direction)}
                        className="pointer-events-auto rounded-full opacity-70 shadow-sm hover:opacity-100 focus-visible:opacity-100 motion-safe:transition-opacity"
                      >
                        <Icon aria-hidden="true" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left" sideOffset={8}>
                      Scroll to {direction}
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            ))}
          </div>
        </div>
      </TooltipProvider>
    </>
  );
}
