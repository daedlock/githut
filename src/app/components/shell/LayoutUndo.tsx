import { X } from "lucide-react";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/app/components/ui/button";
import { Kbd } from "@/app/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import { useKeybindings } from "@/app/hooks/useKeybindings";
import { dismissLayoutNotice, undoLayout, useWorkspaceStore } from "@/app/workspace/store";

const DURATION = 6000;
const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform);

/**
 * Mirrors the store's undo notice into a sonner toast. Sonner pauses the timer
 * while the pointer is over it; keyboard focus inside pauses it too (the toast
 * is re-issued with an infinite duration until focus leaves).
 */
export function LayoutUndo() {
  const notice = useWorkspaceStore((s) => s.notice);
  const canUndo = useWorkspaceStore((s) => s.undo.length > 0);
  const shortcuts = useMemo<Record<string, () => void>>(
    (): Record<string, () => void> => (canUndo ? { "⌘z": undoLayout } : {}),
    [canUndo],
  );
  useKeybindings(shortcuts);

  useEffect(() => {
    if (!notice) return;
    const id = `layout-undo-${notice.id}`;
    // Only clear the store when this toast's notice is still the current one.
    const clear = () => {
      if (useWorkspaceStore.getState().notice?.id === notice.id) dismissLayoutNotice();
    };
    const show = (duration: number) =>
      toast.custom(
        () => (
          <UndoToast
            label={notice.label}
            onFocusChange={(focused) => show(focused ? Number.POSITIVE_INFINITY : DURATION)}
            onUndo={() => {
              undoLayout();
              toast.dismiss(id);
            }}
            onDismiss={() => toast.dismiss(id)}
          />
        ),
        { id, duration, onAutoClose: clear, onDismiss: clear },
      );
    show(DURATION);
    return () => {
      toast.dismiss(id);
    };
  }, [notice]);

  return null;
}

function UndoToast({
  label,
  onUndo,
  onDismiss,
  onFocusChange,
}: {
  label: string;
  onUndo: () => void;
  onDismiss: () => void;
  onFocusChange: (focused: boolean) => void;
}) {
  return (
    <div
      role="status"
      onFocus={() => onFocusChange(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onFocusChange(false);
      }}
      className="flex h-10 items-center gap-3 rounded-xl bg-popover px-3 font-sans text-ui text-popover-foreground shadow-lg ring-1 ring-foreground/10"
    >
      <span>{label}</span>
      <Button
        variant="ghost"
        size="sm"
        onClick={onUndo}
        aria-keyshortcuts={mac ? "Meta+Z" : "Control+Z"}
      >
        Undo <Kbd>{mac ? "⌘Z" : "Ctrl Z"}</Kbd>
      </Button>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-xs" aria-label="Dismiss notice" onClick={onDismiss}>
            <X />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Dismiss notice</TooltipContent>
      </Tooltip>
    </div>
  );
}
