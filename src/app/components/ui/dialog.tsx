import * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { cn } from "@/app/lib/cn"
import { Button } from "@/app/components/ui/button"
import { XIcon } from "lucide-react"

// Root state <DialogOverlay> needs (data-state drives its exit fade). Radix
// keeps its own context private, so the root mirrors it here.
const DialogStateContext = React.createContext({ open: true, modal: true })

function Dialog({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  modal = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen)
  const open = openProp ?? uncontrolledOpen
  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (openProp === undefined) setUncontrolledOpen(next)
      onOpenChange?.(next)
    },
    [openProp, onOpenChange]
  )
  const state = React.useMemo(() => ({ open, modal }), [open, modal])
  return (
    <DialogStateContext.Provider value={state}>
      <DialogPrimitive.Root
        data-slot="dialog"
        open={open}
        onOpenChange={handleOpenChange}
        modal={modal}
        {...props}
      />
    </DialogStateContext.Provider>
  )
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

// Deliberately NOT DialogPrimitive.Overlay. Radix mounts its scroll lock
// (react-remove-scroll) on the Overlay, and react-remove-scroll-bar's
// getGapWidth calls getComputedStyle(document.body) on mount, forcing a
// whole-document style recalc (~600 ms at 4x CPU on a full workspace, #58).
// The workspace body never scrolls (panes do), so the lock buys nothing.
// Modal semantics live on DialogPrimitive.Content and are unaffected: focus
// trap, aria-hidden on siblings, outside pointer blocking, Escape and
// outside-click dismissal. Must render inside <DialogPortal> (it is, via
// DialogContent/SheetContent) so Radix's Presence keeps it for the exit fade.
function DialogOverlay({ className, style, ...props }: React.ComponentProps<"div">) {
  const { open, modal } = React.useContext(DialogStateContext)
  // Same as Radix: a non-modal dialog has no backdrop.
  if (!modal) return null
  return (
    <div
      data-slot="dialog-overlay"
      data-state={open ? "open" : "closed"}
      aria-hidden
      // The modal content sets pointer-events: none on <body>; the backdrop
      // must still receive the click that dismisses the dialog.
      style={{ pointerEvents: "auto", ...style }}
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/40 backdrop-blur-sm duration-100 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/5 duration-100 outline-none sm:max-w-[480px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close data-slot="dialog-close" asChild>
            <Button
              variant="ghost"
              className="absolute top-2 right-2"
              size="icon-sm"
            >
              <XIcon
              />
              <span className="sr-only">Close</span>
            </Button>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t border-border bg-muted/50 p-4 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "text-base leading-none font-medium",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
