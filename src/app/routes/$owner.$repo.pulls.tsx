import { createFileRoute } from "@tanstack/react-router";
import { GitPullRequest } from "lucide-react";
import { ComingSoon } from "@/app/components/ComingSoon";

export const Route = createFileRoute("/$owner/$repo/pulls")({
  component: PullsPage,
});

function PullsPage() {
  return (
    <ComingSoon
      icon={GitPullRequest}
      title="Pull requests"
      description="List, detail, inline review comments, and merge flow. Lands in M4."
    />
  );
}
