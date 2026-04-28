import type * as React from "react";

import { cn } from "@/app/lib/cn";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  const focusedStyles =
    "focus-visible:border-[var(--color-control-border-active)] focus-visible:bg-[var(--color-control-bg-active)] focus-visible:ring-1 focus-visible:ring-[var(--color-control-ring)]";

  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-[var(--color-control-bg)] px-2.5 py-1 text-ui transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-ui file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive",
        focusedStyles,
        className,
      )}
      {...props}
    />
  );
}

export { Input };
