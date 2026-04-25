import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/app/lib/cn";

/**
 * Page container with centered content.
 *
 * Sizes:
 * - lg: max-w-4xl (896px) — list pages (PRs, issues, commits)
 * - xl: max-w-7xl (1280px) — detail pages (default)
 */
type ContainerProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  className?: string;
  as?: "div" | "main" | "header" | "footer" | "nav" | "section";
  size?: "lg" | "xl";
};

const sizeClasses = {
  lg: "max-w-4xl", // 896px
  xl: "max-w-7xl", // 1280px
} as const;

export function Container({ children, className, as: As = "div", size = "xl", ...rest }: ContainerProps) {
  return (
    <As className={cn("mx-auto w-full px-4 sm:px-6", sizeClasses[size], className)} {...rest}>
      {children}
    </As>
  );
}
