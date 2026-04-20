import type { ReactNode } from "react";
import { cn } from "@/app/lib/cn";

export type AppShellProps = {
  header: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function AppShell({ header, footer, children, className }: AppShellProps) {
  return (
    <div className={cn("flex min-h-full flex-col", className)}>
      {header}
      <main className="flex flex-1 flex-col">{children}</main>
      {footer}
    </div>
  );
}
