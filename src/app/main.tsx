import { QueryClientProvider } from "@tanstack/react-query";
import { type AnyRouter, createMemoryHistory, createRouter } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TabHost } from "@/app/components/shell/TabHost";
import { bootstrapAuthFromHash } from "@/app/lib/auth";
import { queryClient } from "@/app/lib/query";
import { listenForSignIn } from "@/app/lib/session";
import { setTabRouterFactory, startBrowserSync } from "@/app/lib/tabRouters";
import { bootstrapTheme } from "@/app/stores/theme";
import { normalizeHref } from "@/app/workspace/model";
import { dispatch, getFocusedTab, initWorkspace } from "@/app/workspace/store";
import "./styles/index.css";
import { routeTree } from "./routeTree.gen";

bootstrapTheme();
const authStart = bootstrapAuthFromHash();

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

// A sign-in popup only hands back its token; it must not save a workspace.
// An OAuth redirect restores this window's focused page instead of opening
// the callback's root URL as a new tab.
if (authStart !== "handoff") {
  const href = normalizeHref(window.location.href);
  initWorkspace(href);
  if (authStart === "redirect") window.history.replaceState(null, "", getFocusedTab().href);
  else dispatch({ type: "openUrl", href });
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
