import { createFileRoute } from "@tanstack/react-router";
import { CircleDot } from "lucide-react";
import { ComingSoon } from "@/app/components/ComingSoon";

export const Route = createFileRoute("/$owner/$repo/issues")({
  component: IssuesPage,
});

function IssuesPage() {
  return (
    <ComingSoon
      icon={CircleDot}
      title="Issues"
      description="List, detail, comments, labels, assignees. Lands in M3."
    />
  );
}
