import type { ReactNode } from "react";
import { cn } from "@/app/lib/cn";

export type ShellHeaderProps = {
  subtitle?: ReactNode;
  right?: ReactNode;
  bordered?: boolean;
  className?: string;
};

export function ShellHeader({ subtitle, right, bordered = false, className }: ShellHeaderProps) {
  return (
    <header
      className={cn(
        "flex items-center justify-between px-6 py-3",
        bordered && "border-b border-[var(--color-border)]",
        className,
      )}
    >
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-sm font-medium tracking-tight">GitHut</span>
        {subtitle ? (
          <span className="font-mono text-xs text-[var(--color-fg-muted)]">{subtitle}</span>
        ) : null}
      </div>
      {right ? <div className="flex items-center gap-1">{right}</div> : null}
    </header>
  );
}
