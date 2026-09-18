import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/app/lib/cn";
import { CONTAINER_WIDTH_OPTIONS } from "@/app/lib/containerWidth";
import { useSettingsStore } from "@/app/stores/settings";

/**
 * Shared page and header bounds, controlled by the saved width preference.
 */
type ContainerProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  className?: string;
  as?: "div" | "main" | "header" | "footer" | "nav" | "section";
};

export function Container({ children, className, as: As = "div", ...rest }: ContainerProps) {
  const width = useSettingsStore((state) => state.containerWidth);
  const widthClass = CONTAINER_WIDTH_OPTIONS.find((option) => option.id === width)?.className;
  return (
    <As className={cn("mx-auto w-full min-w-0 px-4 sm:px-6", widthClass, className)} {...rest}>
      {children}
    </As>
  );
}
