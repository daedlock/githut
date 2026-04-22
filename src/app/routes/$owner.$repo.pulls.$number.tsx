import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/$owner/$repo/pulls/$number")({
  parseParams: (raw) => ({ number: Number(raw.number) }),
  component: PrDetailLayout,
});

// P2 will put the header + sub-tab nav here. For now a pass-through so
// child routes (conversation / files / commits / checks) can mount.
function PrDetailLayout() {
  return <Outlet />;
}
