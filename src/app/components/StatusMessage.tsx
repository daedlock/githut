import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";
import { cn } from "@/app/lib/cn";

const statusVariants = cva("font-mono text-body", {
  variants: {
    tone: {
      muted: "text-muted-foreground",
      danger: "text-destructive",
    },
  },
  defaultVariants: { tone: "muted" },
});

export type StatusMessageProps = {
  children: ReactNode;
  className?: string;
} & VariantProps<typeof statusVariants>;

export function StatusMessage({ tone, children, className }: StatusMessageProps) {
  return <p className={cn(statusVariants({ tone }), className)}>{children}</p>;
}
