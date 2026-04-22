import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { cn } from "@/app/lib/cn";

export type InlineComposerProps = {
  onSubmit: (body: string) => void;
  onCancel: () => void;
  isPending?: boolean;
  submitLabel?: string;
};

export function InlineComposer({
  onSubmit,
  onCancel,
  isPending,
  submitLabel = "Add comment",
}: InlineComposerProps) {
  const [body, setBody] = useState("");

  return (
    <div className="sticky left-0 mx-4 my-2 max-w-[min(100%,calc(100vw-5rem))] rounded-md border border-primary/40 bg-background p-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Leave a comment on this line…"
        rows={3}
        className={cn(
          "w-full resize-none rounded-sm border border-input bg-background p-2",
          "font-mono text-caption text-foreground outline-none",
          "focus-visible:ring-1 focus-visible:ring-(--color-focus)",
        )}
        autoFocus
      />
      <div className="mt-1 flex justify-end gap-2">
        <Button size="xs" variant="ghost" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button
          size="xs"
          disabled={!body.trim() || isPending}
          onClick={() => onSubmit(body.trim())}
        >
          {isPending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </div>
  );
}
