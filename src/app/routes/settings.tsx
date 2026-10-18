import { createFileRoute, redirect } from "@tanstack/react-router";
import { useAuthStore } from "@/app/stores/auth";
import { isSettingsHref, openSettings } from "@/app/stores/settingsModal";
import { getFocusedTab } from "@/app/workspace/store";

// Startup and launchers open the overlay before routing. This catches an
// in-page router link without rendering settings inside a tab.
export const Route = createFileRoute("/settings")({
  beforeLoad: () => {
    if (!useAuthStore.getState().token) throw redirect({ to: "/login" });
    openSettings();
    const href = getFocusedTab().href;
    throw redirect({ href: isSettingsHref(href) ? "/" : href });
  },
});
