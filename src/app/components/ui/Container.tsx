import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/app/lib/cn";

/**
 * Canonical page container. Every page's main content and the inner rows
 * of the shell header/footer/tabs flow through this so vertical grid lines
 * align across the app.
 *
 * width: max-w-6xl (1152px) — wide enough for two-column repo layouts
 * gutter: px-4 / sm:px-6 — 16px mobile, 24px desktop
 */
type ContainerProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  className?: string;
  as?: "div" | "main" | "header" | "footer" | "nav" | "section";
};

export function Container({ children, className, as: As = "div", ...rest }: ContainerProps) {
  return (
    <As className={cn("mx-auto w-full max-w-[1280px] px-4 sm:px-6", className)} {...rest}>
      {children}
    </As>
  );
}
