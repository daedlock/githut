import type { ReactNode } from "react";
import { cn } from "@/app/lib/cn";

/**
 * A labeled group in a detail sidebar (Labels, Assignees, Reviewers, About…).
 * Flat on the page surface: no card, no border. Stack them with `gap-6`.
 */
export function PropertySection({
  icon,
  title,
  action,
  children,
  className,
}: {
  icon?: ReactNode;
  title: string;
  /** Usually a picker trigger (`Button variant="ghost" size="icon-xs"`). */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-2", className)}>
      <div className="flex h-6 items-center gap-1.5">
        {icon && (
          <span aria-hidden className="flex text-(--color-fg-faint) [&_svg]:size-3.5">
            {icon}
          </span>
        )}
        <h3 className="flex-1 text-caption font-medium text-muted-foreground">{title}</h3>
        {action}
      </div>
      <div className="text-ui text-foreground">{children}</div>
    </section>
  );
}

/** Placeholder line inside a PropertySection with no values ("No labels"). */
export function PropertyEmpty({ children }: { children: ReactNode }) {
  return <span className="text-ui text-muted-foreground">{children}</span>;
}
