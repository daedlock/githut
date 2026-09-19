import type { ComponentProps } from "react";
import { cn } from "@/app/lib/cn";

function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn(
        "min-w-0 max-w-full rounded-[var(--radius-xs)] bg-[var(--color-bg-sunken)] motion-safe:animate-pulse",
        className,
      )}
      {...props}
    />
  );
}

function SkeletonGroup({
  label,
  className,
  children,
  ...props
}: ComponentProps<"div"> & { label: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn("min-w-0 max-w-full", className)}
      {...props}
    >
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export { Skeleton, SkeletonGroup };
