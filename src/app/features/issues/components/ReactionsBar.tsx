import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { SmilePlus } from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import type { MyReactionsMap, ReactionContent, ReactionsMap } from "@/app/features/issues/schemas";
import { REACTION_CONTENTS, REACTION_EMOJIS } from "@/app/features/issues/utils";
import { cn } from "@/app/lib/cn";

const REACTION_NAMES: Record<ReactionContent, string> = {
  "+1": "thumbs up",
  "-1": "thumbs down",
  laugh: "laugh",
  hooray: "hooray",
  confused: "confused",
  heart: "heart",
  rocket: "rocket",
  eyes: "eyes",
};

// DESIGN.md micro-interaction curve.
const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Reaction chips under a comment plus an "add reaction" picker. The viewer's
 * own reactions take the active surface, never the brand color.
 */
export function ReactionsBar({
  reactions,
  myReactions,
  onToggle,
  className,
}: {
  reactions: ReactionsMap;
  myReactions: MyReactionsMap;
  onToggle?: (content: ReactionContent, existingReactionId?: number) => void;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const present = REACTION_CONTENTS.filter((k) => (reactions[k] ?? 0) > 0);

  return (
    <div
      className={cn(
        "mt-3 flex flex-wrap items-center gap-1 border-t border-border pt-2.5",
        className,
      )}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {present.map((k) => {
          const mineId = myReactions.get(k);
          const mine = mineId != null;
          const count = reactions[k] ?? 0;
          return (
            <motion.div
              key={k}
              layout={!reduced}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14, ease: EASE }}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onToggle?.(k, mineId)}
                    aria-pressed={mine}
                    aria-label={`${REACTION_NAMES[k]}, ${count}`}
                    className={cn(
                      "inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-caption tabular-nums",
                      "outline-none transition-colors focus-visible:ring-1 focus-visible:ring-foreground/15",
                      mine
                        ? "border-primary bg-[color-mix(in_oklab,var(--color-primary)_12%,var(--color-bg))] text-primary"
                        : "border-border bg-muted text-muted-foreground hover:border-input hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <span aria-hidden>{REACTION_EMOJIS[k]}</span>
                    {count}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {mine ? "Remove your reaction" : `React with ${REACTION_EMOJIS[k]}`}
                </TooltipContent>
              </Tooltip>
            </motion.div>
          );
        })}
      </AnimatePresence>

      <Popover open={open} onOpenChange={setOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Add reaction"
                className="rounded-full"
              >
                <SmilePlus />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Add reaction</TooltipContent>
        </Tooltip>
        <PopoverContent
          side="top"
          align="start"
          aria-label="Add reaction"
          className="w-auto p-1"
          onKeyDown={moveFocusWithArrows}
        >
          <div className="flex gap-0.5">
            {REACTION_CONTENTS.map((k) => {
              const mineId = myReactions.get(k);
              const mine = mineId != null;
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={mine}
                  aria-label={mine ? `Remove ${REACTION_NAMES[k]}` : REACTION_NAMES[k]}
                  onClick={() => {
                    onToggle?.(k, mineId);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex size-8 items-center justify-center rounded-md text-body",
                    "outline-none transition-colors hover:bg-(--color-popover-active) focus-visible:bg-(--color-popover-active)",
                    mine && "bg-(--color-popover-active)",
                  )}
                >
                  <span aria-hidden>{REACTION_EMOJIS[k]}</span>
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** Left/Right (and Home/End) move between the picker's emoji buttons. */
function moveFocusWithArrows(event: KeyboardEvent<HTMLDivElement>) {
  const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
  const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
  const last = buttons.length - 1;
  const targets: Record<string, number> = {
    ArrowRight: current >= last ? 0 : current + 1,
    ArrowLeft: current <= 0 ? last : current - 1,
    Home: 0,
    End: last,
  };
  const next = targets[event.key];
  if (next === undefined) return;
  event.preventDefault();
  buttons[next]?.focus();
}
