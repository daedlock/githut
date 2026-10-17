import {
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/app/components/ui/context-menu";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/app/components/ui/dropdown-menu";
import { getTabMeta } from "@/app/lib/tabMeta";
import type { DockSource, DockTarget } from "@/app/workspace/docking";
import { findIsland, findTab, hrefPathname, islands, selectedTab } from "@/app/workspace/model";
import { dispatch, useWorkspaceStore } from "@/app/workspace/store";

/** Menus and pointer docking dispatch exactly the same command. */
export function DockingMenu({
  source,
  dropdown = false,
}: {
  source: DockSource;
  dropdown?: boolean;
}) {
  const layout = useWorkspaceStore((s) => s.workspace.layout);
  const found = source.type === "tab" ? findTab(layout, source.tabId) : undefined;
  const from = source.type === "tab" ? found?.island : findIsland(layout, source.islandId);
  if (!from) return null;
  const all = islands(layout);
  const others = all.filter((island) => island.id !== from.id);
  const Group = dropdown ? DropdownMenuGroup : ContextMenuGroup;
  const Item = dropdown ? DropdownMenuItem : ContextMenuItem;
  const Sub = dropdown ? DropdownMenuSub : ContextMenuSub;
  const Trigger = dropdown ? DropdownMenuSubTrigger : ContextMenuSubTrigger;
  const Content = dropdown ? DropdownMenuSubContent : ContextMenuSubContent;
  const Separator = dropdown ? DropdownMenuSeparator : ContextMenuSeparator;
  const dock = (target: DockTarget) => dispatch({ type: "dock", source, target });
  const isTab = source.type === "tab";
  const index = found ? from.tabs.findIndex((tab) => tab.id === found.tab.id) : -1;
  return (
    <>
      <Group>
        {isTab && (
          <>
            <Item
              disabled={from.tabs.length < 2}
              onSelect={() => dock({ type: "island-edge", islandId: from.id, side: "right" })}
            >
              Split right
            </Item>
            <Item
              disabled={from.tabs.length < 2}
              onSelect={() => dock({ type: "island-edge", islandId: from.id, side: "bottom" })}
            >
              Split down
            </Item>
            <Sub>
              <Trigger>Reorder tab</Trigger>
              <Content>
                <Group>
                  <Item
                    disabled={index === 0}
                    onSelect={() => dock({ type: "tabs", islandId: from.id, index: index - 1 })}
                  >
                    Move left
                  </Item>
                  <Item
                    disabled={index === from.tabs.length - 1}
                    onSelect={() => dock({ type: "tabs", islandId: from.id, index: index + 2 })}
                  >
                    Move right
                  </Item>
                  <Item
                    disabled={index === 0}
                    onSelect={() => dock({ type: "tabs", islandId: from.id, index: 0 })}
                  >
                    Move to start
                  </Item>
                  <Item
                    disabled={index === from.tabs.length - 1}
                    onSelect={() =>
                      dock({ type: "tabs", islandId: from.id, index: from.tabs.length })
                    }
                  >
                    Move to end
                  </Item>
                </Group>
              </Content>
            </Sub>
          </>
        )}
        <Sub>
          <Trigger disabled={!others.length}>
            {isTab ? "Move to island" : "Merge into island"}
          </Trigger>
          <Content>
            <Group>
              {others.map((island) => (
                <Sub key={island.id}>
                  <Trigger>{islandLabel(island.id, all)}</Trigger>
                  <Content>
                    <Group>
                      <Item
                        onSelect={() =>
                          dock({ type: "tabs", islandId: island.id, index: island.tabs.length })
                        }
                      >
                        At end
                      </Item>
                      {island.tabs.map((tab, i) => (
                        <Item
                          key={tab.id}
                          onSelect={() => dock({ type: "tabs", islandId: island.id, index: i })}
                        >
                          Before {getTabMeta(hrefPathname(tab.href)).label} ({i + 1})
                        </Item>
                      ))}
                    </Group>
                  </Content>
                </Sub>
              ))}
            </Group>
          </Content>
        </Sub>
        <Sub>
          <Trigger>Dock beside island</Trigger>
          <Content>
            <Group>
              {all.map((island) => (
                <Sub key={island.id}>
                  <Trigger disabled={island.id === from.id && (!isTab || from.tabs.length < 2)}>
                    {islandLabel(island.id, all)}
                  </Trigger>
                  <Content>
                    <Group>
                      {(["left", "right", "top", "bottom"] as const).map((side) => (
                        <Item
                          key={side}
                          onSelect={() => dock({ type: "island-edge", islandId: island.id, side })}
                        >
                          {side === "top"
                            ? "Above"
                            : side === "bottom"
                              ? "Below"
                              : side === "left"
                                ? "Left"
                                : "Right"}
                        </Item>
                      ))}
                    </Group>
                  </Content>
                </Sub>
              ))}
            </Group>
          </Content>
        </Sub>
        <Sub>
          <Trigger disabled={all.length === 1 && (!isTab || from.tabs.length < 2)}>
            Dock at window edge
          </Trigger>
          <Content>
            <Group>
              {(["left", "right", "bottom"] as const).map((side) => (
                <Item key={side} onSelect={() => dock({ type: "workspace-edge", side })}>
                  {side === "left" ? "Left" : side === "right" ? "Right" : "Bottom"}
                </Item>
              ))}
            </Group>
          </Content>
        </Sub>
      </Group>
      <Separator />
    </>
  );
}

function islandLabel(id: string, all: ReturnType<typeof islands>): string {
  const index = all.findIndex((island) => island.id === id);
  const meta = getTabMeta(hrefPathname(selectedTab(all[index]!).href));
  return `${index + 1} · ${meta.sublabel ? `${meta.sublabel} · ` : ""}${meta.label}`;
}
