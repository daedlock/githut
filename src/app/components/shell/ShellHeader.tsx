import type { ReactNode } from "react";
import { Container } from "@/app/components/ui/Container";
import { cn } from "@/app/lib/cn";

export type ShellHeaderProps = {
  subtitle?: ReactNode;
  right?: ReactNode;
  bordered?: boolean;
  className?: string;
};

export function ShellHeader({ subtitle, right, bordered = false, className }: ShellHeaderProps) {
  return (
    <header className={cn(bordered && "border-b border-[var(--color-border)]", className)}>
      <Container className="flex items-center justify-between py-3">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-sm font-medium tracking-tight">GitHut</span>
          {subtitle ? (
            <span className="font-mono text-xs text-[var(--color-fg-muted)]">{subtitle}</span>
          ) : null}
        </div>
        {right ? <div className="flex items-center gap-1">{right}</div> : null}
      </Container>
    </header>
  );
}
