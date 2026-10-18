import { X } from "lucide-react";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/app/components/ui/button";
import { Kbd } from "@/app/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import { useKeybindings } from "@/app/hooks/useKeybindings";
import { IS_MAC, MOD_KEY } from "@/app/lib/shortcuts";
import {
  dismissLayoutNotice,
  redoLayout,
  undoLayout,
  useWorkspaceStore,
} from "@/app/workspace/store";

const DURATION = 6000;

/**
 * ⌘Z / ⌘⇧Z for destructive layout changes, and the sonner toast that
 * announces them. Sonner pauses the timer while the pointer is over it;
 * keyboard focus inside pauses it too (the toast is re-issued with an
 * infinite duration until focus leaves).
 */
export function LayoutUndo() {
  const notice = useWorkspaceStore((s) => s.notice);
  const canUndo = useWorkspaceStore((s) => s.undo.length > 0);
  const canRedo = useWorkspaceStore((s) => s.redo.length > 0);
  const shortcuts = useMemo<Record<string, () => void>>(
    () => ({
      ...(canUndo ? { "⌘z": undoLayout } : {}),
      ...(canRedo ? { "⌘shift+z": redoLayout } : {}),
    }),
    [canUndo, canRedo],
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
            undoable={notice.undoable}
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
  undoable,
  onUndo,
  onDismiss,
  onFocusChange,
}: {
  label: string;
  undoable: boolean;
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
      {undoable && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onUndo}
          aria-keyshortcuts={IS_MAC ? "Meta+Z" : "Control+Z"}
        >
          Undo <Kbd>{IS_MAC ? "⌘Z" : `${MOD_KEY} Z`}</Kbd>
        </Button>
      )}
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
