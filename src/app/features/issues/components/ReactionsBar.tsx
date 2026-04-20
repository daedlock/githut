import { Smile } from "lucide-react";
import { useState } from "react";
import type { ReactionContent, ReactionsMap } from "@/app/features/issues/schemas";
import { REACTION_CONTENTS, REACTION_EMOJIS, reactionsHaveAny } from "@/app/features/issues/utils";
import { cn } from "@/app/lib/cn";

export function ReactionsBar({
  reactions,
  onAdd,
}: {
  reactions: ReactionsMap;
  onAdd: (content: ReactionContent) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const hasAny = reactionsHaveAny(reactions);

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[var(--color-border)] pt-2.5">
      {REACTION_CONTENTS.filter((k) => (reactions[k] ?? 0) > 0).map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onAdd(k)}
          className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-2.5 py-0.5 text-xs transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-sunken)]"
        >
          <span>{REACTION_EMOJIS[k]}</span>
          <span className="font-mono text-[var(--color-fg-muted)]">{reactions[k]}</span>
        </button>
      ))}

      <div className="relative">
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          title="Add reaction"
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-colors",
            hasAny
              ? "border-[var(--color-border)] text-[var(--color-fg-faint)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg-muted)]"
              : "border-dashed border-[var(--color-border)] text-[var(--color-fg-faint)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg-muted)]",
          )}
        >
          <Smile className="h-3 w-3" />
        </button>

        {pickerOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setPickerOpen(false)} />
            <div className="absolute left-0 top-full z-20 mt-1.5 flex gap-1 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg)] p-1.5 shadow-lg">
              {REACTION_CONTENTS.map((k) => (
                <button
                  key={k}
                  type="button"
                  title={k}
                  onClick={() => {
                    onAdd(k);
                    setPickerOpen(false);
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded text-base transition-colors hover:bg-[var(--color-bg-sunken)]"
                >
                  {REACTION_EMOJIS[k]}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
