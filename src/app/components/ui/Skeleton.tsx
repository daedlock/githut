import { cn } from "@/app/lib/cn";

/**
 * Static loading placeholder. No pulse animation — we rely on the `.skeleton-fade`
 * wrapper utility for list contexts and count on fast data for everything else.
 * This matches the signature issues-list skeleton style the app standardized on:
 * quiet, precise, no shimmer-theatrics.
 */
export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={cn("rounded-[var(--radius-xs)] bg-[var(--color-bg-sunken)]", className)}
      style={style}
    />
  );
}
