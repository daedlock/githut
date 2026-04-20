import type { LucideIcon } from "lucide-react";
import { cn } from "@/app/lib/cn";

export type ComingSoonProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  className?: string;
};

export function ComingSoon({ title, description, icon: Icon, className }: ComingSoonProps) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center",
        className,
      )}
    >
      {Icon ? <Icon className="h-8 w-8 text-[var(--color-fg-faint)]" strokeWidth={1.5} /> : null}
      <h2 className="font-mono text-title font-medium tracking-tight">
        {title}
        <span className="text-[var(--color-accent)]">_</span>
      </h2>
      {description ? (
        <p className="max-w-sm text-body text-[var(--color-fg-muted)]">{description}</p>
      ) : null}
      <div className="mt-2 font-mono text-micro uppercase tracking-widest text-[var(--color-fg-faint)]">
        coming soon
      </div>
    </div>
  );
}
