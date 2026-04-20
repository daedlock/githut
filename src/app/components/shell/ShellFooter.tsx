import { Kbd } from "@/app/components/ui/Kbd";
import { cn } from "@/app/lib/cn";

export type ShellFooterProps = {
  origin?: string;
  bordered?: boolean;
  showHelpHint?: boolean;
  className?: string;
};

export function ShellFooter({
  origin,
  bordered = false,
  showHelpHint = true,
  className,
}: ShellFooterProps) {
  return (
    <footer
      className={cn(
        "flex items-center justify-between px-6 py-3 font-mono text-[10px] uppercase tracking-widest text-[var(--color-fg-faint)]",
        bordered && "border-t border-[var(--color-border)]",
        className,
      )}
    >
      <span>{origin ?? "\u00a0"}</span>
      {showHelpHint ? (
        <div className="flex items-center gap-1.5">
          <Kbd>?</Kbd>
          <span className="text-[11px] normal-case tracking-normal">for shortcuts</span>
        </div>
      ) : null}
    </footer>
  );
}
