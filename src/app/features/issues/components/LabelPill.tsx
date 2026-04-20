import type { IssueLabel } from "@/app/features/issues/schemas";
import { labelStyle } from "@/app/features/issues/utils";
import { cn } from "@/app/lib/cn";

/**
 * LabelPill — rounded-full GitHub-style label chip.
 * Two sizes:
 *   xs → list rows (tighter line-height so they sit flush with titles)
 *   sm → sidebar / detail header
 */
export function LabelPill({
  label,
  size = "sm",
  className,
}: {
  label: IssueLabel;
  size?: "xs" | "sm";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "rounded-full font-medium",
        size === "xs" ? "px-2 py-px text-micro leading-5" : "px-2 py-0.5 text-caption",
        className,
      )}
      style={labelStyle(label.color)}
      title={label.description ?? label.name}
    >
      {label.name}
    </span>
  );
}
