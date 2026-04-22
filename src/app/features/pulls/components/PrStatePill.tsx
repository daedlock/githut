import {
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  GitPullRequestDraft,
  type LucideIcon,
} from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";
import { stateLabel, type PrUiState } from "@/app/features/pulls/lib/prStatus";
import { cn } from "@/app/lib/cn";

// ─── PrStatePill ───────────────────────────────────────────────────────────
//
// PR-specific lifecycle pill. Not a StatusPill variant because PRs have
// their own iconography (git-pull-request octicon family) and color
// semantics (purple for merged in particular) that don't belong in a
// shared generic primitive.
//
// Color mapping mirrors github.com exactly so users' muscle memory carries
// over:
//   Open    → green (--color-success)
//   Draft   → muted gray (--color-fg-faint)
//   Merged  → purple (--color-pr-merged)
//   Closed  → red    (--color-danger)

const STYLES: Record<
  PrUiState,
  { icon: LucideIcon; tone: string; bg: string }
> = {
  open: {
    icon: GitPullRequest,
    tone: "text-(--color-success)",
    bg: "bg-[color-mix(in_oklab,var(--color-success)_14%,var(--color-bg-subtle))]",
  },
  draft: {
    icon: GitPullRequestDraft,
    tone: "text-(--color-fg-muted)",
    bg: "bg-(--color-bg-sunken)",
  },
  merged: {
    icon: GitMerge,
    tone: "text-(--color-pr-merged)",
    bg: "bg-(--color-pr-merged-bg)",
  },
  closed: {
    icon: GitPullRequestClosed,
    tone: "text-(--color-danger)",
    bg: "bg-[color-mix(in_oklab,var(--color-danger)_14%,var(--color-bg-subtle))]",
  },
};

type Size = "xs" | "sm" | "md";

const SIZES: Record<Size, { wrapper: string; text: string; icon: string }> = {
  xs: { wrapper: "h-4 gap-1 px-1.5", text: "text-micro", icon: "size-2.5" },
  sm: { wrapper: "h-5 gap-1 px-1.5", text: "text-caption", icon: "size-3" },
  md: { wrapper: "h-6 gap-1.5 px-2", text: "text-ui", icon: "size-3.5" },
};

export type PrStatePillProps = {
  state: PrUiState;
  size?: Size;
  iconOnly?: boolean;
  /** Drop the background fill; leave only the icon + text tone. */
  ghost?: boolean;
} & Omit<ComponentPropsWithoutRef<"span">, "children">;

export function PrStatePill({
  state,
  size = "sm",
  iconOnly = false,
  ghost = false,
  className,
  ...rest
}: PrStatePillProps) {
  const style = STYLES[state];
  const sz = SIZES[size];
  const Icon = style.icon;
  const label = stateLabel(state);

  return (
    <span
      {...rest}
      aria-label={iconOnly ? label : undefined}
      className={cn(
        "inline-flex items-center rounded-full font-medium leading-none select-none",
        sz.wrapper,
        style.tone,
        !ghost && style.bg,
        className,
      )}
    >
      <Icon className={cn(sz.icon, "shrink-0")} aria-hidden />
      {!iconOnly && <span className={cn(sz.text, "whitespace-nowrap")}>{label}</span>}
    </span>
  );
}

/**
 * Bare icon, no pill wrapper — used in dense list rows where the full
 * pill is too much chrome. Mirrors `StatusIcon` for consistency.
 */
export function PrStateIcon({
  state,
  className,
  size = 4,
}: {
  state: PrUiState;
  className?: string;
  size?: 3 | 4 | 5;
}) {
  const Icon = STYLES[state].icon;
  return (
    <Icon
      aria-label={stateLabel(state)}
      className={cn(`size-${size}`, STYLES[state].tone, className)}
    />
  );
}
