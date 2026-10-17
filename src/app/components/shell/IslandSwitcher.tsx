import { Check, ChevronDown, PanelsTopLeft } from "lucide-react";
import { useRef } from "react";
import { TONE_CLASS, UnreadDot, useTabDisplay } from "@/app/components/shell/TabStrip";
import { Button } from "@/app/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { focusPaneOfFocusedTab, selectTab } from "@/app/lib/tabActions";
import { islands, type Tab } from "@/app/workspace/model";
import { useWorkspaceStore } from "@/app/workspace/store";

/** All tabs remain reachable, including selections in islands hidden by narrow mode. */
export function IslandSwitcher() {
  const workspace = useWorkspaceStore((state) => state.workspace);
  const selected = useRef(false);
  const all = islands(workspace.layout);
  return (
    <div className="flex h-8 shrink-0 items-center pb-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" aria-label="Switch island or tab">
            <PanelsTopLeft data-icon="inline-start" />
            Island {all.findIndex((island) => island.id === workspace.focusedIslandId) + 1} of{" "}
            {all.length}
            <ChevronDown data-icon="inline-end" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="max-h-[min(70dvh,32rem)] w-72 max-w-[calc(100vw-2rem)] overflow-y-auto"
          onCloseAutoFocus={(event) => {
            if (!selected.current) return;
            selected.current = false;
            event.preventDefault();
            focusPaneOfFocusedTab();
          }}
        >
          {all.map((island, index) => (
            <DropdownMenuGroup key={island.id}>
              <DropdownMenuLabel>Island {index + 1}</DropdownMenuLabel>
              {island.tabs.map((tab) => {
                const current =
                  island.id === workspace.focusedIslandId && tab.id === island.selectedTabId;
                return (
                  <TabChoice
                    key={tab.id}
                    tab={tab}
                    current={current}
                    onSelect={() => {
                      selected.current = true;
                      selectTab(tab.id);
                    }}
                  />
                );
              })}
            </DropdownMenuGroup>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function TabChoice({
  tab,
  current,
  onSelect,
}: {
  tab: Tab;
  current: boolean;
  onSelect: () => void;
}) {
  const display = useTabDisplay(tab.href);
  const Icon = display.icon;
  return (
    <DropdownMenuItem
      data-switcher-tab={tab.id}
      onSelect={onSelect}
      aria-current={current ? "page" : undefined}
      aria-label={`${display.prefix ?? ""} ${display.label}${display.status ? `, ${display.status}` : ""}${display.unread ? ", unread" : ""}`}
    >
      <Icon className={TONE_CLASS[display.tone]} />
      <span className="min-w-0 flex-1 truncate">
        {display.repo ? `${display.repo} · ` : ""}
        {display.prefix ? `${display.prefix} ` : ""}
        {display.label}
      </span>
      {display.unread && <UnreadDot />}
      {current && <Check />}
    </DropdownMenuItem>
  );
}
