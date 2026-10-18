import { X } from "lucide-react";
import { type ReactElement, useEffect } from "react";
import { Button } from "@/app/components/ui/button";
import { Popover, PopoverAnchor, PopoverContent } from "@/app/components/ui/popover";
import { markTabHintSeen, retireTabHint, useTabHintStore } from "@/app/stores/tabHint";
import { islands } from "@/app/workspace/model";
import { useWorkspaceStore } from "@/app/workspace/store";

const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
const SIDE_KEY = IS_MAC ? "Option" : "Alt";

/**
 * A one-time tip shown the first time a window has two tabs. It is marked as
 * seen as soon as it shows, so it never comes back after a reload, and any
 * click outside, Escape or the first split dismisses it.
 */
export function TabHint({ focused, children }: { focused: boolean; children: ReactElement }) {
  const retired = useTabHintStore((s) => s.retired);
  const twoTabs = useWorkspaceStore(
    (s) => islands(s.workspace.layout).reduce((n, i) => n + i.tabs.length, 0) >= 2,
  );
  const open = focused && twoTabs && !retired;
  useEffect(() => {
    if (open) markTabHintSeen();
  }, [open]);
  return (
    <Popover open={open}>
      <PopoverAnchor asChild>{children}</PopoverAnchor>
      <PopoverContent
        aria-label="Tab tips"
        align="start"
        side="bottom"
        sideOffset={8}
        className="w-auto max-w-[calc(100vw-2rem)] flex-row items-center gap-2 data-[state=open]:animate-none data-[state=closed]:animate-none"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={retireTabHint}
        onEscapeKeyDown={retireTabHint}
      >
        <p className="text-caption text-muted-foreground">
          Drag a tab to split. Shift-click opens a new tab, {SIDE_KEY}-click opens it beside.
        </p>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Dismiss tab tips"
          onClick={retireTabHint}
        >
          <X />
        </Button>
      </PopoverContent>
    </Popover>
  );
}
