import { createFileRoute, Outlet } from "@tanstack/react-router";

// The /pulls tree has its own layout-child structure:
//   /pulls                  → list
//   /pull/$number          → detail (conversation by default)
//   /pull/$number/files    → files changed
//   /pull/$number/commits  → commits in PR
//   /pull/$number/checks   → checks
// This parent route is mostly a pass-through; the list and detail layouts
// do their own chrome.

export const Route = createFileRoute("/$owner/$repo/pulls")({
  component: PullsLayout,
});

function PullsLayout() {
  return <Outlet />;
}
