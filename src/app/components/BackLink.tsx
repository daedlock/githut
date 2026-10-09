import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { type ComponentProps, type ReactNode, useEffect, useRef } from "react";
import { Kbd } from "@/app/components/ui/kbd";
import { cn } from "@/app/lib/cn";

/**
 * "← Issues" above a detail page's title. Escape follows it, like closing a
 * detail view in a desktop app, unless something with its own Escape (an
 * input, a menu, a dialog) has focus or is open.
 */
export function BackLink({
  className,
  children,
  ...props
}: Omit<ComponentProps<typeof Link>, "children"> & { children: ReactNode }) {
  const link = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.closest(
            "input, textarea, select, [role=textbox], [role=dialog], [role=menu], [role=listbox], [data-radix-popper-content-wrapper]",
          ))
      )
        return;
      // An open overlay owns Escape even when focus has left it.
      if (
        document.querySelector(
          "[role=dialog][data-state=open], [data-radix-popper-content-wrapper]",
        )
      )
        return;
      event.preventDefault();
      link.current?.click();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <Link
      ref={link}
      aria-keyshortcuts="Escape"
      className={cn(
        "group/back -ml-1.5 inline-flex h-6 items-center gap-1.5 rounded-md px-1.5 text-caption text-muted-foreground",
        "outline-none transition-colors hover:bg-muted hover:text-foreground",
        "focus-visible:ring-1 focus-visible:ring-foreground/15",
        className,
      )}
      {...props}
    >
      <ArrowLeft aria-hidden className="size-3.5" />
      {children}
      <Kbd className="opacity-0 transition-opacity group-hover/back:opacity-100 group-focus-visible/back:opacity-100 [@media(hover:none)]:hidden">
        Esc
      </Kbd>
    </Link>
  );
}
