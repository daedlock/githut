import { createFileRoute } from "@tanstack/react-router";
import { Code2 } from "lucide-react";
import { ComingSoon } from "@/app/components/ComingSoon";

export const Route = createFileRoute("/$owner/$repo/code")({
  component: CodePage,
});

function CodePage() {
  return (
    <ComingSoon
      icon={Code2}
      title="Code"
      description="File tree, blob viewer, commits, branches, and diffs. Lands in M2."
    />
  );
}
