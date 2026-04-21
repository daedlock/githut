import * as React from "react";

import { cn } from "@/app/lib/cn";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  const focusedStyles =
    "focus-visible:bg-[var(--color-fg-muted)]/5 focus-visible:border-[var(--color-fg-muted)]/20";
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive md:text-sm",
        focusedStyles,
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
