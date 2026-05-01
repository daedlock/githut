import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { CommandPalette } from "@/app/components/CommandPalette";
import { FileHistorySheet } from "@/app/components/code/FileHistorySheet";
import { KeyboardHelp } from "@/app/components/KeyboardHelp";
import { TabSyncProvider } from "@/app/components/shell/TabSyncProvider";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: () => (
    <TabSyncProvider>
      <Outlet />
      <CommandPalette />
      <KeyboardHelp />
      <FileHistorySheet />
    </TabSyncProvider>
  ),
});
