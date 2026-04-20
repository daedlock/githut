import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type Ref } from "react";
import { cn } from "@/app/lib/cn";

/**
 * Avatar — user avatar with graceful fallback (first initial).
 *
 * Sizes were chosen to match existing inline usage:
 *   xs → 4 (h-4)   — tightest contexts, reactions
 *   sm → 5 (h-5)   — comment headers, assignee chips, mention dropdown
 *   md → 6 (h-6)   — moderately sized author slots
 *   lg → 7 (h-7)   — user menu in app shell
 *
 * Fallback uses mono uppercase on bg-sunken to match the overall industrial
 * token aesthetic. Border sits on --color-border to be consistent with how
 * avatars used to be rendered inline.
 */
const avatarVariants = cva(
  "inline-flex flex-shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] font-mono uppercase text-[var(--color-fg-muted)] bg-[var(--color-bg-sunken)]",
  {
    variants: {
      size: {
        xs: "h-4 w-4 text-[8px]",
        sm: "h-5 w-5 text-[9px]",
        md: "h-6 w-6 text-[10px]",
        lg: "h-7 w-7 text-[11px] border-[var(--color-border-strong)]",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

export type AvatarProps = {
  login: string;
  avatarUrl?: string | null;
  className?: string;
} & VariantProps<typeof avatarVariants>;

export const Avatar = forwardRef<HTMLElement, AvatarProps>(
  ({ login, avatarUrl, size, className }, ref) => {
    if (avatarUrl) {
      return (
        <img
          ref={ref as Ref<HTMLImageElement>}
          src={avatarUrl}
          alt={login}
          className={cn(avatarVariants({ size }), "bg-transparent", className)}
        />
      );
    }
    const initial = login.slice(0, 1) || "?";
    return (
      <span
        ref={ref as Ref<HTMLSpanElement>}
        role="img"
        aria-label={login}
        className={cn(avatarVariants({ size }), className)}
      >
        {initial}
      </span>
    );
  },
);
Avatar.displayName = "Avatar";
