import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { CommandPalette } from "@/app/components/CommandPalette";
import { FileHistorySheet } from "@/app/components/code/FileHistorySheet";
import { KeyboardHelp } from "@/app/components/KeyboardHelp";
import { OpenInGithubLink } from "@/app/components/OpenInGithubLink";
import { ScrollToBottom } from "@/app/components/ScrollToBottom";
import { DocumentTitle } from "@/app/components/shell/DocumentTitle";
import { TabSyncProvider } from "@/app/components/shell/TabSyncProvider";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: () => (
    <TabSyncProvider>
      <DocumentTitle />
      <Outlet />
      <ScrollToBottom />
      <CommandPalette />
      <KeyboardHelp />
      <FileHistorySheet />
      <OpenInGithubLink />
    </TabSyncProvider>
  ),
});
