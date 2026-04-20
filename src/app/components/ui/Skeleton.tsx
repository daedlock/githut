import { cn } from "@/app/lib/cn";

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-[var(--radius-xs)] bg-[var(--color-bg-sunken)]",
        className,
      )}
      style={style}
    />
  );
}
