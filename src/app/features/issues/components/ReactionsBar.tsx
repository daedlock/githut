import { AnimatePresence, motion } from "framer-motion";
import { Smile } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { MyReactionsMap, ReactionContent, ReactionsMap } from "@/app/features/issues/schemas";
import { REACTION_CONTENTS, REACTION_EMOJIS, reactionsHaveAny } from "@/app/features/issues/utils";
import { cn } from "@/app/lib/cn";
import { useCanMutate } from "@/app/lib/connectivity";

const POP = { type: "spring" as const, stiffness: 600, damping: 22, mass: 0.5 };
const HOVER = { type: "spring" as const, stiffness: 400, damping: 10, mass: 0.3 };
const BADGE = { type: "spring" as const, stiffness: 500, damping: 20, mass: 0.5 };
const N = REACTION_CONTENTS.length;

const pickerVariants = {
  hidden: { opacity: 0, scale: 0 },
  show: (i: number) => ({ opacity: 1, scale: 1, transition: { ...POP, delay: i * 0.018 } }),
  gone: (i: number) => ({
    opacity: 0,
    scale: 0,
    transition: { ...POP, delay: (N - 1 - i) * 0.014 },
  }),
};

const badgeVariants = {
  hidden: { opacity: 0, scale: 0.5 },
  show: { opacity: 1, scale: 1, transition: BADGE },
  gone: {
    opacity: 0,
    scale: 0.5,
    transition: { duration: 0.12, ease: [0.4, 0, 1, 1] as [number, number, number, number] },
  },
};

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
  const { canMutate, reason } = useCanMutate();
  const [open, setOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const hasAny = reactionsHaveAny(reactions);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div
      ref={barRef}
      className={cn(
        "mt-3 flex flex-wrap items-center gap-1 border-t border-border pt-2.5",
        className,
      )}
    >
      <AnimatePresence mode="popLayout">
        {REACTION_CONTENTS.filter((k) => (reactions[k] ?? 0) > 0).map((k) => {
          const mineId = myReactions.get(k);
          const mine = mineId != null;
          return (
            <motion.button
              key={k}
              layout
              variants={badgeVariants}
              initial="hidden"
              animate="show"
              exit="gone"
              transition={{ layout: BADGE }}
              type="button"
              onClick={() => onToggle?.(k, mineId)}
              disabled={!canMutate || !onToggle}
              aria-pressed={mine}
              title={reason ?? (mine ? "Remove your reaction" : `React with ${k}`)}
              className={cn(
                "inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 leading-none",
                "outline-none transition-colors",
                "focus-visible:ring-1 focus-visible:ring-foreground/15",
                mine
                  ? "border-primary bg-[color-mix(in_oklab,var(--color-primary)_12%,var(--color-bg))] text-primary"
                  : "border-border bg-muted text-muted-foreground hover:border-input hover:bg-[var(--color-bg-sunken)]",
              )}
            >
              <span className="text-[11px] leading-none">{REACTION_EMOJIS[k]}</span>
              <span
                className={cn(
                  "inline-flex font-mono text-[10px] tabular-nums leading-none",
                  mine && "font-semibold",
                )}
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={reactions[k]}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    transition={{ type: "spring", stiffness: 800, damping: 30, mass: 0.3 }}
                    className="inline-block"
                  >
                    {reactions[k]}
                  </motion.span>
                </AnimatePresence>
              </span>
            </motion.button>
          );
        })}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={reason ?? "Add reaction"}
        disabled={!canMutate || !onToggle}
        aria-label="Add reaction"
        aria-expanded={open}
        className={cn(
          "inline-flex h-6 items-center gap-1 rounded-full border px-2.5 leading-none",
          "outline-none transition-colors",
          "focus-visible:ring-1 focus-visible:ring-foreground/15",
          open
            ? "border-input text-muted-foreground bg-muted"
            : "text-[var(--color-fg-faint)] hover:text-muted-foreground hover:border-input",
          !open && (hasAny ? "border-border" : "border-dashed border-border"),
        )}
      >
        <Smile className="size-3" />
      </button>

      <AnimatePresence>
        {open &&
          canMutate &&
          REACTION_CONTENTS.map((k, i) => {
            const mineId = myReactions.get(k);
            const mine = mineId != null;
            return (
              <motion.button
                key={`picker-${k}`}
                custom={i}
                variants={pickerVariants}
                initial="hidden"
                animate="show"
                exit="gone"
                type="button"
                title={mine ? `Remove ${k}` : k}
                onClick={() => {
                  onToggle?.(k, mineId);
                  setOpen(false);
                }}
                className={cn(
                  "flex size-6 items-center justify-center rounded-full leading-none",
                  "outline-none",
                  mine && "bg-[var(--color-bg-sunken)]",
                )}
              >
                <motion.span
                  className="text-[13px] leading-none"
                  whileHover={{ scale: 1.5, y: -6 }}
                  transition={HOVER}
                >
                  {REACTION_EMOJIS[k]}
                </motion.span>
              </motion.button>
            );
          })}
      </AnimatePresence>
    </div>
  );
}
