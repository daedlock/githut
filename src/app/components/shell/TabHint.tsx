import { X } from "lucide-react";
import type { ReactElement } from "react";
import { Button } from "@/app/components/ui/button";
import { Popover, PopoverAnchor, PopoverContent } from "@/app/components/ui/popover";
import { retireTabHint, useTabHintStore } from "@/app/stores/tabHint";
import { islands } from "@/app/workspace/model";
import { useWorkspaceStore } from "@/app/workspace/store";

export function TabHint({ focused, children }: { focused: boolean; children: ReactElement }) {
  const retired = useTabHintStore((s) => s.retired);
  const twoTabs = useWorkspaceStore(
    (s) => islands(s.workspace.layout).reduce((n, i) => n + i.tabs.length, 0) >= 2,
  );
  return (
    <Popover open={focused && twoTabs && !retired}>
      <PopoverAnchor asChild>{children}</PopoverAnchor>
      <PopoverContent
        aria-label="Tab tips"
        align="start"
        side="bottom"
        sideOffset={8}
        className="w-auto max-w-[calc(100vw-2rem)] flex-row items-center gap-2 data-[state=open]:animate-none data-[state=closed]:animate-none"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={retireTabHint}
      >
        <p className="text-caption text-muted-foreground">
          drag to split · ⇧-click new tab · ⌥-click to the side
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
