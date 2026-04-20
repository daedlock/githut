import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { CommandPalette } from "@/app/components/CommandPalette";
import { KeyboardHelp } from "@/app/components/KeyboardHelp";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: () => (
    <>
      <Outlet />
      <CommandPalette />
      <KeyboardHelp />
    </>
  ),
});
