import { Play } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/app/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { Input } from "@/app/components/ui/input";
import { useDispatchWorkflow } from "@/app/features/actions/hooks";
import type {
  DispatchInput,
  WorkflowDispatchSchema,
} from "@/app/features/actions/lib/parseDispatchInputs";
import { cn } from "@/app/lib/cn";

export type DispatchDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  owner: string;
  repo: string;
  workflowName: string;
  workflowId: number;
  defaultRef: string;
  schema: WorkflowDispatchSchema;
};

// ─── DispatchDialog ────────────────────────────────────────────────────────
//
// Renders a dynamic form from the workflow's `workflow_dispatch.inputs`
// schema. Inputs become typed controls:
//   string       → <Input>
//   choice       → <select> of allowed options
//   boolean      → checkbox
//   environment  → string input (we can't enumerate envs without an extra
//                  API call; accepting free text is GitHub's fallback too)
//   number       → <Input type="number">
//
// On submit, POSTs via `useDispatchWorkflow` and closes. Runs list
// invalidates on success so the newly-queued run appears at the top.

export function DispatchDialog({
  open,
  onOpenChange,
  owner,
  repo,
  workflowName,
  workflowId,
  defaultRef,
  schema,
}: DispatchDialogProps) {
  const dispatch = useDispatchWorkflow(owner, repo);

  // Initial state from the schema defaults — recalculated each time the
  // dialog opens so reopening gets a fresh form (avoids stale state after
  // a previous dispatch).
  const initial = useMemo(() => initialValues(schema.inputs), [schema.inputs]);
  const [ref, setRef] = useState(defaultRef);
  const [values, setValues] = useState<Record<string, string | boolean | number>>(initial);

  // Reset when the dialog transitions from closed → open so a new
  // invocation starts from defaults.
  if (open && ref === "" && defaultRef) {
    setRef(defaultRef);
  }

  const setValue = (key: string, v: string | boolean | number) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    dispatch.mutate(
      { workflowId, ref, inputs: schema.inputs.length > 0 ? values : undefined },
      {
        onSuccess: () => {
          onOpenChange(false);
          // Reset for next time
          setValues(initial);
        },
      },
    );
  };

  const missingRequired = schema.inputs.some(
    (i) =>
      i.required &&
      (i.type === "string" || i.type === "environment") &&
      !String(values[i.key] ?? "").trim(),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-mono text-body font-medium">Run workflow</DialogTitle>
          <DialogDescription>
            Trigger <span className="font-mono text-foreground">{workflowName}</span> on a
            chosen branch. Inputs come from the workflow's{" "}
            <span className="font-mono">workflow_dispatch</span> definition.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field
            label="Branch or tag"
            description="The ref the workflow will check out. Defaults to the repo's default branch."
          >
            <Input
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              placeholder="main"
              className="font-mono"
              autoFocus
            />
          </Field>

          {schema.inputs.length > 0 ? (
            <div className="flex flex-col gap-3 border-t border-border pt-4">
              {schema.inputs.map((input) => (
                <InputField
                  key={input.key}
                  input={input}
                  value={values[input.key]}
                  onChange={(v) => setValue(input.key, v)}
                />
              ))}
            </div>
          ) : null}

          {dispatch.isError ? (
            <p className="text-caption text-destructive">
              Could not trigger workflow. Your token may be missing the{" "}
              <span className="font-mono">workflow</span> scope.
            </p>
          ) : null}

          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="sm">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              size="sm"
              disabled={!ref.trim() || missingRequired || dispatch.isPending}
            >
              <Play data-icon="inline-start" />
              {dispatch.isPending ? "Dispatching…" : "Run workflow"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Field primitives (local) ──────────────────────────────────────────────

function Field({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-sans text-caption font-medium text-foreground">{label}</span>
      {children}
      {description ? (
        <span className="font-sans text-caption text-muted-foreground">{description}</span>
      ) : null}
    </label>
  );
}

function InputField({
  input,
  value,
  onChange,
}: {
  input: DispatchInput;
  value: string | boolean | number | undefined;
  onChange: (v: string | boolean | number) => void;
}) {
  const labelText = input.required ? `${input.key} *` : input.key;

  switch (input.type) {
    case "choice":
      return (
        <Field label={labelText} description={input.description}>
          <select
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            className={cn(
              "h-8 w-full rounded-md border border-input bg-background px-2 font-mono text-ui",
              "outline-none focus-visible:ring-1 focus-visible:ring-(--color-focus)",
            )}
          >
            {!input.required && !input.default ? <option value="" /> : null}
            {(input.options ?? []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </Field>
      );

    case "boolean":
      return (
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            className="mt-0.5 size-4 rounded-sm border-input accent-(--color-brand)"
          />
          <span className="flex flex-col gap-0.5">
            <span className="font-sans text-caption font-medium text-foreground">
              {labelText}
            </span>
            {input.description ? (
              <span className="font-sans text-caption text-muted-foreground">
                {input.description}
              </span>
            ) : null}
          </span>
        </label>
      );

    case "number":
      return (
        <Field label={labelText} description={input.description}>
          <Input
            type="number"
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
            className="font-mono"
          />
        </Field>
      );

    case "environment":
    case "string":
    default:
      return (
        <Field label={labelText} description={input.description}>
          <Input
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            placeholder={input.default !== undefined ? String(input.default) : ""}
            className="font-mono"
          />
        </Field>
      );
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function initialValues(
  inputs: DispatchInput[],
): Record<string, string | boolean | number> {
  const out: Record<string, string | boolean | number> = {};
  for (const input of inputs) {
    if (input.default !== undefined) {
      out[input.key] = input.default;
    } else if (input.type === "boolean") {
      out[input.key] = false;
    } else if (input.type === "choice" && input.options && input.options.length > 0) {
      // biome-ignore lint/style/noNonNullAssertion: length check above
      out[input.key] = input.options[0]!;
    } else {
      out[input.key] = "";
    }
  }
  return out;
}
