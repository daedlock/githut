import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/app/lib/cn";

const inputVariants = cva(
  [
    "w-full bg-[var(--color-bg)] text-[var(--color-fg)]",
    "border border-[var(--color-border-strong)]",
    "placeholder:text-[var(--color-fg-faint)]",
    "rounded-[var(--radius-md)]",
    "transition-colors duration-75",
    "focus:border-[var(--color-focus)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]/30",
    "disabled:cursor-not-allowed disabled:opacity-50",
  ],
  {
    variants: {
      variant: {
        default: "",
        mono: "font-mono tracking-tight",
      },
      size: {
        sm: "h-7 px-2 text-ui",
        md: "h-9 px-3 text-body",
        lg: "h-11 px-4 text-body",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> &
  VariantProps<typeof inputVariants>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant, size, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(inputVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Input.displayName = "Input";
