import type { ReactNode } from "react";
import { cn } from "@/app/lib/cn";

export type WidgetProps = {
  title: string;
  meta?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
};

export function Widget({ title, meta, actions, children, className, bodyClassName }: WidgetProps) {
  return (
    <section
      className={cn(
        "flex flex-col rounded-md border border-input bg-muted",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <div className="flex items-baseline gap-2 min-w-0">
          <h2 className="font-mono text-ui font-medium uppercase tracking-widest text-foreground truncate">
            {title}
          </h2>
          {meta ? (
            <span className="font-mono text-micro tabular-nums uppercase tracking-widest text-[var(--color-fg-faint)]">
              {meta}
            </span>
          ) : null}
        </div>
        {actions ? <div className="flex items-center gap-1.5">{actions}</div> : null}
      </header>
      <div className={cn("flex-1", bodyClassName ?? "p-4")}>{children}</div>
    </section>
  );
}
