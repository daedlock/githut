import { cn } from "@/app/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-[var(--radius-xs)] bg-[var(--color-bg-sunken)]",
        className,
      )}
    />
  );
}
