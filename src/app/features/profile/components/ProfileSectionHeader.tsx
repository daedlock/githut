import type { ReactNode } from "react";

import { cn } from "@/app/lib/cn";

export function ProfileSectionHeader({
  icon,
  title,
  count,
  className,
}: {
  icon?: ReactNode;
  title: string;
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {icon ? (
        <span className="text-(--color-fg-faint)" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <h2 className="min-w-0 flex-1 truncate text-ui font-[475] text-foreground">{title}</h2>
      {typeof count === "number" ? (
        <span className="font-mono text-caption tabular-nums text-muted-foreground">{count}</span>
      ) : null}
    </div>
  );
}
