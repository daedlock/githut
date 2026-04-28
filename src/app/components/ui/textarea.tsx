import type * as React from "react";

import { cn } from "@/app/lib/cn";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  const focusedStyles =
    "focus-visible:border-[var(--color-control-border-active)] focus-visible:bg-[var(--color-control-bg-active)] focus-visible:ring-1 focus-visible:ring-[var(--color-control-ring)]";
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-[var(--color-control-bg)] px-2.5 py-2 text-body transition-colors outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive",
        focusedStyles,
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
