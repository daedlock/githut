import { Play } from "lucide-react";
import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { DispatchDialog } from "@/app/features/actions/components/DispatchDialog";
import { useWorkflowDispatchSchema } from "@/app/features/actions/hooks";
import type { Workflow } from "@/app/features/actions/schemas";
import { useRepo } from "@/app/hooks/useRepo";

export type DispatchBarProps = {
  owner: string;
  repo: string;
  workflow: Workflow;
};

// ─── DispatchBar ───────────────────────────────────────────────────────────
//
// Renders above the runs list when the currently-selected workflow supports
// `workflow_dispatch`. Reads the workflow's YAML, parses its inputs, and
// opens a dynamic-form dialog on click. Yields to nothing when the workflow
// is non-dispatchable — no visual placeholder.

export function DispatchBar({ owner, repo, workflow }: DispatchBarProps) {
  const [open, setOpen] = useState(false);
  const { schema, isPending } = useWorkflowDispatchSchema(owner, repo, workflow.path);
  const repoQuery = useRepo(owner, repo);
  const defaultRef = repoQuery.data?.default_branch ?? "main";

  // No bar until we know the workflow is dispatchable. Avoids flashing
  // the "Run workflow" affordance on every workflow switch.
  if (isPending || !schema || !schema.dispatchable || workflow.state !== "active") return null;

  const hasInputs = schema.inputs.length > 0;

  return (
    <>
      <div className="flex min-h-10 items-center justify-between gap-3 rounded-lg bg-muted px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <Play
            className="size-3.5 shrink-0 text-muted-foreground"
            aria-hidden
            strokeWidth={2.25}
          />
          <span className="truncate font-sans text-ui text-muted-foreground">
            <span className="font-mono text-foreground">{workflow.name}</span>
            <span className="ml-1.5">
              can be triggered manually
              {hasInputs
                ? ` · ${schema.inputs.length} input${schema.inputs.length === 1 ? "" : "s"}`
                : ""}
            </span>
          </span>
        </div>
        <Button
          type="button"
          size="sm"
          variant="default"
          onClick={() => setOpen(true)}
          className="shrink-0"
        >
          <Play data-icon="inline-start" />
          Run workflow
        </Button>
      </div>

      <DispatchDialog
        open={open}
        onOpenChange={setOpen}
        owner={owner}
        repo={repo}
        workflowName={workflow.name}
        workflowId={workflow.id}
        defaultRef={defaultRef}
        schema={schema}
      />
    </>
  );
}
