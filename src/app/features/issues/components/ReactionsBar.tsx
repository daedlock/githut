import { Smile } from "lucide-react";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import type { MyReactionsMap, ReactionContent, ReactionsMap } from "@/app/features/issues/schemas";
import { REACTION_CONTENTS, REACTION_EMOJIS, reactionsHaveAny } from "@/app/features/issues/utils";
import { cn } from "@/app/lib/cn";

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
  const [pickerOpen, setPickerOpen] = useState(false);
  const hasAny = reactionsHaveAny(reactions);

  return (
    <div className={cn("mt-3 flex flex-wrap items-center gap-1 border-t border-border pt-2.5", className)}>
      {REACTION_CONTENTS.filter((k) => (reactions[k] ?? 0) > 0).map((k) => {
        const mineId = myReactions.get(k);
        const mine = mineId != null;
        return (
          <button
            key={k}
            type="button"
            onClick={() => onToggle?.(k, mineId)}
            aria-pressed={mine}
            title={mine ? "Remove your reaction" : `React with ${k}`}
            className={cn(
              "inline-flex h-5 items-center gap-1 rounded-full border px-2 leading-none",
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
                "font-mono text-[10px] leading-none tabular-nums",
                mine && "font-semibold",
              )}
            >
              {reactions[k]}
            </span>
          </button>
        );
      })}

      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            title="Add reaction"
            aria-label="Add reaction"
            className={cn(
              "inline-flex h-5 items-center gap-1 rounded-full border px-2 leading-none",
              "outline-none transition-colors",
              "focus-visible:ring-1 focus-visible:ring-foreground/15",
              "text-[var(--color-fg-faint)] hover:text-muted-foreground hover:border-input",
              hasAny ? "border-border" : "border-dashed border-border",
            )}
          >
            <Smile className="size-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="start"
          sideOffset={6}
          className="flex w-auto flex-row gap-0.5 p-1 data-[state=open]:animate-none"
          style={{ animation: "spread 200ms cubic-bezier(0.16, 1, 0.3, 1)" }}
        >
          {REACTION_CONTENTS.map((k, i) => {
            const mineId = myReactions.get(k);
            const mine = mineId != null;
            return (
              <button
                key={k}
                type="button"
                title={mine ? `Remove ${k}` : k}
                onClick={() => {
                  onToggle?.(k, mineId);
                  setPickerOpen(false);
                }}
                className={cn(
                  "flex size-7 items-center justify-center rounded-md leading-none",
                  "outline-none transition-colors",
                  "focus-visible:ring-1 focus-visible:ring-foreground/15",
                  "animate-[pop_180ms_cubic-bezier(0.16,1,0.3,1)_both]",
                  mine
                    ? "bg-[color-mix(in_oklab,var(--color-primary)_14%,var(--color-bg))] ring-1 ring-primary"
                    : "hover:bg-[var(--color-popover-active)]",
                )}
                style={{ animationDelay: `${i * 25}ms` }}
              >
                <span className="text-sm leading-none">{REACTION_EMOJIS[k]}</span>
              </button>
            );
          })}
        </PopoverContent>
      </Popover>
    </div>
  );
}
