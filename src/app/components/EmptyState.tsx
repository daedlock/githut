import { AlertCircle, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/app/lib/cn";

/**
 * The one empty / error state: a faint icon over a single muted line, with an
 * optional action below. `tone="error"` swaps in a destructive alert icon.
 */
export function EmptyState({
  icon: Icon = AlertCircle,
  tone = "empty",
  children,
  action,
  className,
}: {
  icon?: LucideIcon;
  tone?: "empty" | "error";
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={cn("flex flex-col items-center gap-2 px-4 py-16 text-center", className)}
    >
      <Icon
        aria-hidden
        className={cn("size-5", tone === "error" ? "text-destructive" : "text-(--color-fg-faint)")}
      />
      <p className="max-w-[72ch] text-body text-muted-foreground">{children}</p>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
