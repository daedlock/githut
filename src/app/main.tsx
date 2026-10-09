import { QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TooltipProvider } from "@/app/components/ui/tooltip";
import { bootstrapAuthFromHash } from "@/app/lib/auth";
import { queryClient } from "@/app/lib/query";
import { bootstrapTheme } from "@/app/stores/theme";
import "./styles/index.css";
import { routeTree } from "./routeTree.gen";

bootstrapTheme();
bootstrapAuthFromHash();

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");

const shell = document.getElementById("shell");
if (shell) shell.classList.add("hide");

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* Desktop-style tooltips: a beat before the first, instant across a toolbar. */}
      <TooltipProvider delayDuration={500} skipDelayDuration={300}>
        <RouterProvider router={router} />
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>,
);
