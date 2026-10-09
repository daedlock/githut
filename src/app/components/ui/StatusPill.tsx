import {
  AlertCircle,
  Ban,
  CheckCircle2,
  CircleDashed,
  CircleSlash,
  Clock3,
  Loader2,
  type LucideIcon,
  MinusCircle,
  XCircle,
} from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/app/lib/cn";

// ─── Variant → presentation ────────────────────────────────────────────────
//
// StatusPill is intentionally decoupled from the feature enum types. Consumers
// map their domain status onto a `variant` keyword (via e.g. a UiStatus union)
// and StatusPill handles all of the icon / color / pulse concerns.
//
// This keeps the same pill usable for run status, PR check runs, issue state,
// deploy status — anywhere GitHub surfaces a lifecycle state.

export type StatusPillVariant =
  | "running"
  | "queued"
  | "waiting"
  | "pending"
  | "action_required"
  | "timed_out"
  | "startup_failure"
  | "stale"
  | "unknown"
  | "success"
  | "failure"
  | "cancelled"
  | "skipped"
  | "neutral";

type VariantStyle = {
  icon: LucideIcon;
  /** Foreground color for icon + text. A theme token, not a hex value. */
  tone: string;
  /** Background fill. Uses color-mix so it stays in-theme as palette shifts. */
  bg: string;
  /** Icon color when it differs from the text (faint glyphs for skipped states). */
  iconTone?: string;
  /** Extra classes — e.g. spin animation for live states. */
  extra?: string;
};

// Status-colored states tint their fill from the status color; neutral states
// share one neutral fill (`bg-accent`, visible on the page and on panels).
const WARNING_BG = "bg-[color-mix(in_oklab,var(--color-warning)_14%,var(--color-bg-subtle))]";
const DANGER_BG = "bg-[color-mix(in_oklab,var(--color-danger)_14%,var(--color-bg-subtle))]";
const SUCCESS_BG = "bg-[color-mix(in_oklab,var(--color-success)_12%,var(--color-bg-subtle))]";
const NEUTRAL_BG = "bg-accent";

const STYLES: Record<StatusPillVariant, VariantStyle> = {
  waiting: { icon: Clock3, tone: "text-(--color-warning)", bg: WARNING_BG },
  pending: { icon: CircleDashed, tone: "text-muted-foreground", bg: NEUTRAL_BG },
  action_required: { icon: AlertCircle, tone: "text-(--color-warning)", bg: WARNING_BG },
  timed_out: { icon: Clock3, tone: "text-destructive", bg: DANGER_BG },
  startup_failure: { icon: XCircle, tone: "text-destructive", bg: DANGER_BG },
  stale: {
    icon: CircleSlash,
    tone: "text-muted-foreground",
    iconTone: "text-(--color-fg-faint)",
    bg: NEUTRAL_BG,
  },
  unknown: { icon: CircleDashed, tone: "text-muted-foreground", bg: NEUTRAL_BG },
  running: {
    icon: Loader2,
    tone: "text-(--color-warning)",
    bg: WARNING_BG,
    extra: "[&_[data-pill-icon]]:motion-safe:animate-spin",
  },
  queued: { icon: CircleDashed, tone: "text-muted-foreground", bg: NEUTRAL_BG },
  success: { icon: CheckCircle2, tone: "text-(--color-success)", bg: SUCCESS_BG },
  failure: { icon: XCircle, tone: "text-destructive", bg: DANGER_BG },
  cancelled: { icon: Ban, tone: "text-muted-foreground", bg: NEUTRAL_BG },
  skipped: {
    icon: CircleSlash,
    tone: "text-muted-foreground",
    iconTone: "text-(--color-fg-faint)",
    bg: NEUTRAL_BG,
  },
  neutral: { icon: MinusCircle, tone: "text-muted-foreground", bg: NEUTRAL_BG },
};

// ─── Size variants ─────────────────────────────────────────────────────────

type Size = "xs" | "sm" | "md";

const SIZE_CLASSES: Record<Size, { wrapper: string; text: string; icon: string }> = {
  xs: {
    wrapper: "h-4 gap-1 px-1.5",
    text: "text-micro",
    icon: "size-2.5",
  },
  sm: {
    wrapper: "h-5 gap-1 px-1.5",
    text: "text-caption",
    icon: "size-3",
  },
  md: {
    wrapper: "h-6 gap-1.5 px-2",
    text: "text-ui",
    icon: "size-3.5",
  },
};

// ─── Component ─────────────────────────────────────────────────────────────

export type StatusPillProps = {
  variant: StatusPillVariant;
  /** Text to show. If omitted, capitalized variant name is used. */
  label?: string;
  size?: Size;
  /** When true, render icon only (no label). Aria-label is set from `label`. */
  iconOnly?: boolean;
  /** When true, no bg fill — just the icon + text. Useful on dense rows. */
  ghost?: boolean;
} & Omit<ComponentPropsWithoutRef<"span">, "children">;

export function StatusPill({
  variant,
  label,
  size = "sm",
  iconOnly = false,
  ghost = false,
  className,
  ...rest
}: StatusPillProps) {
  const style = STYLES[variant];
  const sizing = SIZE_CLASSES[size];
  const Icon = style.icon;
  const text = label ?? defaultLabel(variant);

  return (
    <span
      {...rest}
      {...(iconOnly ? { role: "img", "aria-label": text } : {})}
      className={cn(
        "inline-flex items-center rounded-full font-medium select-none",
        sizing.wrapper,
        style.tone,
        !ghost && style.bg,
        style.extra,
        className,
      )}
    >
      <Icon data-pill-icon className={cn(sizing.icon, "shrink-0", style.iconTone)} aria-hidden />
      {!iconOnly && <span className={cn(sizing.text, "whitespace-nowrap")}>{text}</span>}
    </span>
  );
}

// ─── Dot (icon-less mini indicator) ────────────────────────────────────────

/**
 * Minimal 8px colored dot — for dense places where even the pill is too
 * much chrome (e.g. left gutter of a list row). Shares the tone palette
 * with StatusPill so variants feel consistent across the surface.
 */
export function StatusDot({
  variant,
  className,
  ...rest
}: { variant: StatusPillVariant } & ComponentPropsWithoutRef<"span">) {
  const tone =
    variant === "running" || variant === "waiting" || variant === "action_required"
      ? "bg-(--color-warning)"
      : variant === "success"
        ? "bg-(--color-success)"
        : variant === "failure" || variant === "timed_out" || variant === "startup_failure"
          ? "bg-(--color-danger)"
          : variant === "queued"
            ? "bg-(--color-fg-muted)"
            : "bg-(--color-fg-faint)";
  return (
    <span
      {...rest}
      aria-hidden
      className={cn("inline-block size-2 shrink-0 rounded-full", tone, className)}
    />
  );
}

function defaultLabel(v: StatusPillVariant): string {
  if (v === "running") return "In progress";
  return v.charAt(0).toUpperCase() + v.slice(1).replaceAll("_", " ");
}

// ─── StatusIcon (bare) ─────────────────────────────────────────────────────

/**
 * Just the status's icon with its tone color — no pill, no label. For dense
 * list rows where `StatusPill` adds too much chrome. Mirrors the treatment
 * `IssueRow` uses for open/closed icons — consistent across the app.
 */
export function StatusIcon({
  variant,
  className,
  size = 4,
}: {
  variant: StatusPillVariant;
  className?: string;
  /** Tailwind size scale — 3 = size-3 (12px), 4 = size-4 (16px), etc. */
  size?: 3 | 4 | 5;
}) {
  const style = STYLES[variant];
  const Icon = style.icon;
  return (
    <Icon
      aria-label={defaultLabel(variant)}
      className={cn(
        size === 3 ? "size-3" : size === 5 ? "size-5" : "size-4",
        style.iconTone ?? style.tone,
        variant === "running" && "motion-safe:animate-spin",
        className,
      )}
    />
  );
}

// Discriminated-union narrowing helper so consumers using a `UiStatus`-style
// object can pass `variant={s.kind}` without type friction.
export type StatusPillVariantOf<T extends { kind: StatusPillVariant }> = T["kind"];
