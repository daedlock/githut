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
    <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-[var(--color-border)] pt-2.5">
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
              "inline-flex h-5 items-center gap-1 rounded-full border px-2 leading-none transition-colors",
              mine
                ? "border-[var(--color-accent)] bg-[color-mix(in_oklab,var(--color-accent)_12%,var(--color-bg))] text-[var(--color-accent)]"
                : "border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-sunken)]",
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
          className={cn(
            "inline-flex h-5 items-center gap-1 rounded-full border px-2 leading-none transition-colors",
            hasAny
              ? "border-[var(--color-border)] text-[var(--color-fg-faint)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg-muted)]"
              : "border-dashed border-[var(--color-border)] text-[var(--color-fg-faint)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg-muted)]",
          )}
        >
          <Smile className="h-3 w-3" />
        </button>

        {pickerOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setPickerOpen(false)}
              role="presentation"
            />
            <div className="absolute left-0 top-full z-20 mt-1.5 flex gap-0.5 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg)] p-1 shadow-lg">
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
                      "flex h-6 w-6 items-center justify-center rounded leading-none transition-colors",
                      mine
                        ? "bg-[color-mix(in_oklab,var(--color-accent)_14%,var(--color-bg))] ring-1 ring-[var(--color-accent)]"
                        : "hover:bg-[var(--color-bg-sunken)]",
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
