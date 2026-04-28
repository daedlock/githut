import type * as React from "react";
import { Badge } from "@/app/components/ui/badge";
import { cn } from "@/app/lib/cn";

export type ChangeStatsBadgeProps = Omit<React.ComponentProps<"span">, "children"> & {
  additions: number;
  deletions: number;
};

const countFormatter = new Intl.NumberFormat("en-US");

function formatChangeCount(value: number) {
  return countFormatter.format(value);
}

export function ChangeStatsBadge({
  additions,
  deletions,
  className,
  "aria-label": ariaLabel,
  ...props
}: ChangeStatsBadgeProps) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "h-5 gap-1.5 bg-muted px-2 font-mono text-caption font-[475] tabular-nums text-muted-foreground",
        className,
      )}
      aria-label={ariaLabel ?? `${additions} additions and ${deletions} deletions`}
      {...props}
    >
      <span className="text-[var(--diff-add-marker)]">+{formatChangeCount(additions)}</span>
      <span className="text-[var(--diff-del-marker)]">−{formatChangeCount(deletions)}</span>
    </Badge>
  );
}
