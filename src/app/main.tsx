import { QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRouter } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TabHost } from "@/app/components/shell/TabHost";
import { bootstrapAuthFromHash } from "@/app/lib/auth";
import { queryClient } from "@/app/lib/query";
import { setTabRouterFactory, startBrowserSync } from "@/app/lib/tabRouters";
import { getTabsSnapshot, normalizeHref, syncActive, useTabsStore } from "@/app/stores/tabs";
import { bootstrapTheme } from "@/app/stores/theme";
import "./styles/index.css";
import { routeTree } from "./routeTree.gen";

bootstrapTheme();
bootstrapAuthFromHash();

/** Every tab runs its own router over an in-memory history (see TabHost). */
function createAppRouter(href: string) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",
    history: createMemoryHistory({ initialEntries: [href] }),
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}

setTabRouterFactory(createAppRouter);

// Reconcile persisted tabs with the URL we were opened at: focus the tab
// already showing it, otherwise point the active tab there.
{
  const href = normalizeHref(window.location.href);
  const match = getTabsSnapshot().tabs.find((t) => t.href === href);
  useTabsStore
    .getState()
    .apply((s) => (match ? { ...s, activeId: match.id } : syncActive(s, href)));
}
startBrowserSync();

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");

const shell = document.getElementById("shell");
if (shell) shell.classList.add("hide");

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TabHost />
    </QueryClientProvider>
  </StrictMode>,
);
