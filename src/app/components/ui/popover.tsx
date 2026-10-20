import { Popover as PopoverPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/app/lib/cn";

const PopoverVisit = React.createContext({ active: { current: true }, open: false });

function Popover({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  const [localOpen, setLocalOpen] = React.useState(defaultOpen);
  const open = controlledOpen ?? localOpen;
  const changeRef = React.useRef(onOpenChange);
  changeRef.current = onOpenChange;
  const active = React.useRef(true);
  const openRef = React.useRef(open);
  openRef.current = open;
  const visit = React.useMemo(() => ({ active, open }), [open]);
  // Activity preserves state but tears down effects when a tab stops being
  // shown. A transient overlay belongs to that visit, not the kept-alive page.
  React.useLayoutEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      if (openRef.current) {
        setLocalOpen(false);
        changeRef.current?.(false);
      }
    };
  }, []);
  return (
    <PopoverVisit.Provider value={visit}>
      <PopoverPrimitive.Root
        data-slot="popover"
        {...props}
        open={open}
        onOpenChange={(next) => {
          setLocalOpen(next);
          onOpenChange?.(next);
        }}
      />
    </PopoverVisit.Provider>
  );
}

function PopoverTrigger({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  onCloseAutoFocus,
  style,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  const { active, open } = React.useContext(PopoverVisit);
  const host = React.useRef<HTMLDivElement | null>(null);
  // Allocate only after first use; a large conversation can own hundreds of
  // closed popovers. Keep the host for the exit animation and later visits.
  if (open && !host.current && typeof document !== "undefined")
    host.current = document.createElement("div");
  const container = host.current;
  // React Activity can re-render a body portal after hiding its originating
  // subtree. Detach its host synchronously with that subtree's effects.
  React.useLayoutEffect(() => {
    if (!container) return;
    Object.assign(container.style, {
      position: "fixed",
      inset: "0",
      contain: "layout style",
      pointerEvents: "none",
      zIndex: "50",
    });
    document.body.appendChild(container);
    return () => {
      container.remove();
    };
  }, [container]);
  return (
    <PopoverPrimitive.Portal container={container}>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        style={{ pointerEvents: "auto", ...style }}
        hideWhenDetached
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event);
          if (!active.current) event.preventDefault();
        }}
        className={cn(
          "z-50 flex w-72 origin-(--radix-popover-content-transform-origin) flex-col gap-2.5 rounded-lg bg-popover p-2.5 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden duration-100 motion-reduce:data-[state=open]:animate-none motion-reduce:data-[state=closed]:animate-none data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

function PopoverAnchor({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />;
}

function PopoverHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="popover-header"
      className={cn("flex flex-col gap-0.5 text-sm", className)}
      {...props}
    />
  );
}

function PopoverTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return <div data-slot="popover-title" className={cn("font-medium", className)} {...props} />;
}

function PopoverDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="popover-description"
      className={cn("text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
};
