import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/app/lib/cn";

export type KbdProps = HTMLAttributes<HTMLElement>;

export const Kbd = forwardRef<HTMLElement, KbdProps>(({ className, children, ...props }, ref) => (
  <kbd
    ref={ref}
    className={cn(
      "inline-flex h-5 min-w-5 items-center justify-center px-1",
      "font-mono text-[11px] font-medium",
      "bg-[var(--color-bg-subtle)] text-[var(--color-fg-muted)]",
      "border border-b-2 border-[var(--color-border-strong)]",
      "rounded-[var(--radius-sm)]",
      className,
    )}
    {...props}
  >
    {children}
  </kbd>
));
Kbd.displayName = "Kbd";
