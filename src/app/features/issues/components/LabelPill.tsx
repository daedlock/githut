import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import type { IssueLabel } from "@/app/features/issues/schemas";
import { labelStyle } from "@/app/features/issues/utils";
import { cn } from "@/app/lib/cn";

/**
 * LabelPill — muted surface with a user-authored colored edge.
 * Two sizes:
 *   xs → list rows (tighter line-height so they sit flush with titles)
 *   sm → sidebar / detail header
 * The label's description, when it has one, shows in a tooltip.
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
  const pill = (
    <span
      className={cn(
        "rounded-full border border-border bg-muted font-medium",
        size === "xs" ? "px-2 py-px text-micro leading-5" : "px-2 py-0.5 text-caption",
        className,
      )}
      style={labelStyle(label.color)}
    >
      {label.name}
    </span>
  );
  if (!label.description) return pill;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{pill}</TooltipTrigger>
      <TooltipContent side="top">{label.description}</TooltipContent>
    </Tooltip>
  );
}
