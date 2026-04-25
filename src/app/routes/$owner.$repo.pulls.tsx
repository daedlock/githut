import { createFileRoute, Outlet } from "@tanstack/react-router";

// The /pulls tree has its own layout-child structure:
//   /pulls                  → list
//   /pulls/$number          → detail (conversation by default)
//   /pulls/$number/files    → files changed
//   /pulls/$number/commits  → commits in PR
//   /pulls/$number/checks   → checks
// This parent route is mostly a pass-through; the list and detail layouts
// do their own chrome.

export const Route = createFileRoute("/$owner/$repo/pulls")({
  component: PullsLayout,
});

function PullsLayout() {
return <div className="w-3xl mx-auto"><Outlet /></div>;
}
