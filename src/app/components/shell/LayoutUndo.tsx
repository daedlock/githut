import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useMemo } from "react";
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

/** ⌘Z / ⌘⇧Z for destructive layout changes, and the toast that announces them. */
export function LayoutUndo() {
  const notice = useWorkspaceStore((s) => s.notice);
  const canUndo = useWorkspaceStore((s) => s.undo.length > 0);
  const canRedo = useWorkspaceStore((s) => s.redo.length > 0);
  const reduced = useReducedMotion();
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
    const timeout = setTimeout(dismissLayoutNotice, 6000);
    return () => clearTimeout(timeout);
  }, [notice]);

  return (
    <AnimatePresence>
      {notice && (
        <motion.div
          key={notice.id}
          role="status"
          initial={{ opacity: 0, y: reduced ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed bottom-6 left-1/2 z-40 flex h-10 -translate-x-1/2 items-center gap-3 rounded-xl bg-popover px-3 text-ui shadow-lg ring-1 ring-foreground/10"
        >
          <span>{notice.label}</span>
          {notice.undoable && (
            <Button
              variant="ghost"
              size="sm"
              onClick={undoLayout}
              aria-keyshortcuts={IS_MAC ? "Meta+Z" : "Control+Z"}
            >
              Undo <Kbd>{IS_MAC ? "⌘Z" : `${MOD_KEY} Z`}</Kbd>
            </Button>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Dismiss notice"
                onClick={dismissLayoutNotice}
              >
                <X />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Dismiss notice</TooltipContent>
          </Tooltip>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
