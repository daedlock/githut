import { ArrowDownToLine, ArrowUpToLine } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/app/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/app/components/ui/tooltip";

export function PageScrollControls() {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [canScrollToTop, setCanScrollToTop] = useState(false);
  const [canScrollToBottom, setCanScrollToBottom] = useState(false);

  useEffect(() => {
    const updateTopVisibility = () => setCanScrollToTop(window.scrollY > 0);
    updateTopVisibility();
    window.addEventListener("scroll", updateTopVisibility, { passive: true });
    return () => window.removeEventListener("scroll", updateTopVisibility);
  }, []);

  useEffect(() => {
    const bottom = bottomRef.current;
    if (!bottom) return;

    // Watching the page end also handles navigation, late content, and resizing.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) setCanScrollToBottom(!entry.isIntersecting);
      },
      { rootMargin: "0px 0px 96px 0px" },
    );
    observer.observe(bottom);
    return () => observer.disconnect();
  }, []);

  function scrollTo(direction: "top" | "bottom") {
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : "smooth";
    if (direction === "top") {
      window.scrollTo({ top: 0, behavior });
    } else {
      bottomRef.current?.scrollIntoView({ behavior, block: "end" });
    }
  }

  return (
    <>
      <div ref={bottomRef} aria-hidden="true" className="pointer-events-none -mt-px h-px w-px" />
      <TooltipProvider delayDuration={400}>
        {/* On narrow screens, a list's bulk action bar needs this corner. */}
        <div className="pointer-events-none fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 flex flex-col gap-2 max-sm:[body:has([data-bulk-bar])_&]:hidden">
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
      </TooltipProvider>
    </>
  );
}
