import * as React from "react";

import { cn } from "@/app/lib/cn";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  const focusedStyles =
    "focus-visible:bg-[var(--color-fg-muted)]/5 focus-visible:border-[var(--color-fg-muted)]/20";

  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground  disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive md:text-sm",
        focusedStyles,
        className,
      )}
      {...props}
    />
  );
}

export { Input };
