import { QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRouter } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TabHost } from "@/app/components/shell/TabHost";
import { bootstrapAuthFromHash } from "@/app/lib/auth";
import { queryClient } from "@/app/lib/query";
import { listenForSignIn } from "@/app/lib/session";
import { setTabRouterFactory, startBrowserSync } from "@/app/lib/tabRouters";
import { getTabsSnapshot, normalizeHref, syncActive, useTabsStore } from "@/app/stores/tabs";
import { bootstrapTheme } from "@/app/stores/theme";
import "./styles/index.css";
import { routeTree } from "./routeTree.gen";

bootstrapTheme();
const authStart = bootstrapAuthFromHash();

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
// already showing it, otherwise point the active tab there. Back from an
// OAuth redirect the URL is just "/", not a page the user asked for: keep the
// workspace as it was and show its focused tab instead. The sign-in popup
// shares the tab storage and must not touch it at all.
if (authStart !== "handoff") {
  if (authStart === "redirect") {
    const { tabs, activeId } = getTabsSnapshot();
    const focused = tabs.find((t) => t.id === activeId);
    if (focused) window.history.replaceState(null, "", focused.href);
  }
  const href = normalizeHref(window.location.href);
  const match = getTabsSnapshot().tabs.find((t) => t.href === href);
  useTabsStore
    .getState()
    .apply((s) => (match ? { ...s, activeId: match.id } : syncActive(s, href)));
}

function SignedInHandoff() {
  return (
    <div className="flex h-full items-center justify-center bg-background p-6 text-body text-muted-foreground">
      Signed in. You can close this window.
    </div>
  );
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");

const shell = document.getElementById("shell");
if (shell) shell.classList.add("hide");

if (authStart === "handoff") {
  // The sign-in popup: its token went to the workspace window. Close, or
  // say so if the browser won't let a script close this window.
  window.close();
  createRoot(rootEl).render(<SignedInHandoff />);
} else {
  startBrowserSync();
  listenForSignIn();
  createRoot(rootEl).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <TabHost />
      </QueryClientProvider>
    </StrictMode>,
  );
}
