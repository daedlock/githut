import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";

// Each tab renders its own copy of this tree (see TabHost). App-wide overlays
// — palette, help, scroll controls — live once in TabHost, bound to the focused tab.
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Outlet,
});
