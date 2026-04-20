import { Smile } from "lucide-react";
import { useState } from "react";
import type { MyReactionsMap, ReactionContent, ReactionsMap } from "@/app/features/issues/schemas";
import { REACTION_CONTENTS, REACTION_EMOJIS, reactionsHaveAny } from "@/app/features/issues/utils";
import { cn } from "@/app/lib/cn";

/**
 * ReactionsBar — emoji pills + a picker. Pills are toggle buttons: clicking a
 * pill the viewer has already reacted to removes the reaction (DELETE by the
 * stored reaction id); clicking an unreacted emoji adds one (POST).
 *
 * The "I reacted" state comes from `myReactions` (content → reactionId map).
 * A non-positive id is an optimistic placeholder while a POST is in flight —
 * the UI still renders as "reacted" but the eventual real id comes back on
 * success and is used for future toggles.
 */
export function ReactionsBar({
  reactions,
  myReactions,
  onToggle,
}: {
  reactions: ReactionsMap;
  myReactions: MyReactionsMap;
  onToggle: (content: ReactionContent, existingReactionId?: number) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const hasAny = reactionsHaveAny(reactions);

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-border pt-2.5">
      {REACTION_CONTENTS.filter((k) => (reactions[k] ?? 0) > 0).map((k) => {
        const mineId = myReactions.get(k);
        const mine = mineId != null;
        return (
          <button
            key={k}
            type="button"
            onClick={() => onToggle(k, mineId)}
            aria-pressed={mine}
            title={mine ? "Remove your reaction" : `React with ${k}`}
            className={cn(
              "inline-flex h-5 items-center gap-1 rounded-full border px-2 leading-none",
              "outline-none transition-colors",
              "focus-visible:ring-1 focus-visible:ring-ring/20",
              mine
                ? "border-primary bg-[color-mix(in_oklab,var(--color-primary)_12%,var(--color-bg))] text-primary"
                : "border-border bg-muted text-muted-foreground hover:border-input hover:bg-accent",
            )}
          >
            {/* Explicit sizing — system emoji fonts ignore text-xs/text-caption
                and render at their native metric. Pin both font-size and line-height
                so the pill stays the same height regardless of emoji glyph. */}
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

      <div className="relative">
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          title="Add reaction"
          aria-label="Add reaction"
          className={cn(
            "inline-flex h-5 items-center gap-1 rounded-full border px-2 leading-none",
            "outline-none transition-colors",
            "focus-visible:ring-1 focus-visible:ring-ring/20",
            "text-[var(--color-fg-faint)] hover:text-muted-foreground hover:border-input",
            hasAny ? "border-border" : "border-dashed border-border",
          )}
        >
          <Smile className="size-3" />
        </button>

        {pickerOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setPickerOpen(false)}
              role="presentation"
            />
            <div className="absolute left-0 top-full z-20 mt-1.5 flex gap-0.5 rounded-md border border-input bg-popover p-1 shadow-md ring-1 ring-foreground/10">
              {REACTION_CONTENTS.map((k) => {
                const mineId = myReactions.get(k);
                const mine = mineId != null;
                return (
                  <button
                    key={k}
                    type="button"
                    title={mine ? `Remove ${k}` : k}
                    onClick={() => {
                      onToggle(k, mineId);
                      setPickerOpen(false);
                    }}
                    className={cn(
                      "flex size-6 items-center justify-center rounded-sm leading-none",
                      "outline-none transition-colors",
                      "focus-visible:ring-1 focus-visible:ring-ring/20",
                      mine
                        ? "bg-[color-mix(in_oklab,var(--color-primary)_14%,var(--color-bg))] ring-1 ring-primary"
                        : "hover:bg-accent",
                    )}
                  >
                    <span className="text-[13px] leading-none">{REACTION_EMOJIS[k]}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
