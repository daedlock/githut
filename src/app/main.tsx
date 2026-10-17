import { QueryClientProvider } from "@tanstack/react-query";
import { type AnyRouter, createMemoryHistory, createRouter } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TabHost } from "@/app/components/shell/TabHost";
import { bootstrapAuthFromHash } from "@/app/lib/auth";
import { queryClient } from "@/app/lib/query";
import { setTabRouterFactory, startBrowserSync } from "@/app/lib/tabRouters";
import { bootstrapTheme } from "@/app/stores/theme";
import { normalizeHref } from "@/app/workspace/model";
import { dispatch, initWorkspace } from "@/app/workspace/store";
import "./styles/index.css";
import { routeTree } from "./routeTree.gen";

bootstrapTheme();
bootstrapAuthFromHash();

/** Every tab runs its own router over an in-memory history (see TabHost). */
function createAppRouter(href: string, history?: AnyRouter["history"]) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",
    history: history ?? createMemoryHistory({ initialEntries: [href] }),
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}

setTabRouterFactory(createAppRouter);

// Restore this window's layout, then reconcile it with the URL we were
// opened at: focus the tab already showing it, otherwise open it in the
// focused island (ADR 0002).
{
  const href = normalizeHref(window.location.href);
  initWorkspace(href);
  dispatch({ type: "openUrl", href });
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
