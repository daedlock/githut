import { useState } from "react";
import { cn } from "@/app/lib/cn";

export type InlineComposerProps = {
  onSubmit: (body: string) => void;
  onCancel: () => void;
  isPending?: boolean;
  submitLabel?: string;
  placeholder?: string;
};

export function InlineComposer({
  onSubmit,
  onCancel,
  isPending,
  submitLabel = "Add comment",
  placeholder = "Leave a comment on this line…",
}: InlineComposerProps) {
  const [body, setBody] = useState("");

  return (
    <div className="sticky left-0 mx-4 my-2 max-w-[calc(100cqi-3rem)] rounded-lg border border-primary/40 bg-background p-3">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className={cn(
          "w-full resize-none rounded-lg border border-input bg-background p-2.5",
          "text-sm text-foreground placeholder:text-muted-foreground",
          "focus:outline-none focus:ring-2 focus:ring-ring/40",
        )}
        autoFocus
      />
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs font-medium",
            "text-muted-foreground hover:text-foreground transition-colors",
          )}
          onClick={onCancel}
          disabled={isPending}
        >
          Cancel
        </button>
        <button
          type="button"
          className={cn(
            "rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground",
            "transition-colors hover:bg-primary/90",
            "disabled:pointer-events-none disabled:opacity-50",
          )}
          disabled={!body.trim() || isPending}
          onClick={() => onSubmit(body.trim())}
        >
          {isPending ? "Saving…" : submitLabel}
        </button>
      </div>
    </div>
  );
}
