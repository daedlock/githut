import { Slot } from "@radix-ui/react-slot";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/app/lib/cn";

// ─── Side navigation ───────────────────────────────────────────────────────
//
// Left-hand view lists (dashboard filters, workflows, run jobs). One recipe:
// hover is the raised surface, the current item is the active surface.

export function NavLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex h-7 items-center px-2 text-micro font-medium uppercase tracking-widest text-muted-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}

type NavItemProps = ComponentProps<"button"> & {
  /** Render the child (e.g. a router `<Link>`) with the nav-item styles. */
  asChild?: boolean;
  active?: boolean;
};

export function NavItem({ asChild, active, className, ...props }: NavItemProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      aria-current={active ? "page" : undefined}
      className={cn(
        "group/nav flex h-7 w-full min-w-0 items-center gap-2 rounded-lg px-2 text-left text-ui text-muted-foreground",
        "outline-none transition-colors hover:bg-muted hover:text-foreground",
        "focus-visible:ring-1 focus-visible:ring-foreground/15",
        "aria-[current=page]:bg-accent aria-[current=page]:text-foreground",
        "[&_svg]:size-3.5 [&_svg]:shrink-0",
        className,
      )}
      {...(asChild ? {} : { type: "button" })}
      {...props}
    />
  );
}

/** Trailing count inside a NavItem. */
export function NavCount({ children }: { children: ReactNode }) {
  return (
    <span className="ml-auto text-caption tabular-nums text-muted-foreground group-aria-[current=page]/nav:text-foreground">
      {children}
    </span>
  );
}
