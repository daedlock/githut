import { ArrowDownToLine } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/app/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/app/components/ui/tooltip";

export function ScrollToBottom() {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState(false);

  useEffect(() => {
    const bottom = bottomRef.current;
    if (!bottom) return;

    // Watching the page end also handles navigation, late content, and resizing.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) setCanScroll(!entry.isIntersecting && entry.boundingClientRect.top > 0);
      },
      { rootMargin: "0px 0px 96px 0px" },
    );
    observer.observe(bottom);
    return () => observer.disconnect();
  }, []);

  function scrollToBottom() {
    bottomRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "end",
    });
  }

  return (
    <>
      <div ref={bottomRef} aria-hidden="true" className="pointer-events-none -mt-px h-px w-px" />
      {canScroll && (
        <TooltipProvider delayDuration={400}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon-lg"
                aria-label="Scroll to bottom"
                onClick={scrollToBottom}
                className="fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 rounded-full opacity-70 shadow-sm hover:opacity-100 focus-visible:opacity-100 motion-safe:transition-opacity"
              >
                <ArrowDownToLine aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" sideOffset={8}>
              Scroll to bottom
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </>
  );
}
