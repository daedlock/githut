import { cva, type VariantProps } from "class-variance-authority";
import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/app/lib/cn";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium",
    "border transition-colors duration-75",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]",
    "disabled:pointer-events-none disabled:opacity-50",
    "rounded-[var(--radius-md)]",
  ],
  {
    variants: {
      variant: {
        primary: [
          "bg-[var(--color-accent)] text-[var(--color-accent-fg)] border-transparent",
          "hover:bg-[var(--color-accent-hover)]",
          "active:translate-y-px",
        ],
        secondary: [
          "bg-[var(--color-bg)] text-[var(--color-fg)] border-[var(--color-border-strong)]",
          "hover:bg-[var(--color-bg-subtle)]",
        ],
        ghost: [
          "bg-transparent text-[var(--color-fg)] border-transparent",
          "hover:bg-[var(--color-bg-subtle)]",
        ],
        danger: [
          "bg-[var(--color-danger)] text-white border-transparent",
          "hover:opacity-90",
          "active:translate-y-px",
        ],
      },
      size: {
        sm: "h-7 px-2.5 text-ui",
        md: "h-9 px-3.5 text-body",
        lg: "h-11 px-5 text-body",
        icon: "h-9 w-9 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";
