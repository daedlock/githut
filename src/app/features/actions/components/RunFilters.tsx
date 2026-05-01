import { X } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/app/components/ui/toggle-group";
import { cn } from "@/app/lib/cn";

// ─── Filters ───────────────────────────────────────────────────────────────
//
// Slot-compatible with `<Widget actions={...}>` — lives inside the widget
// header band (DESIGN.md's Widget pattern) instead of floating above the
// list. `rounded-sm` chips instead of `rounded-full` to match the rest of
// the app's chrome.

type StatusFilter =
  | "all"
  | "queued"
  | "in_progress"
  | "completed"
  | "success"
  | "failure"
  | "cancelled";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "success", label: "Success" },
  { value: "failure", label: "Failure" },
  { value: "in_progress", label: "In progress" },
  { value: "queued", label: "Queued" },
  { value: "cancelled", label: "Cancelled" },
];

export type RunFiltersProps = {
  status?: StatusFilter;
  branch?: string;
  event?: string;
  actor?: string;
  onStatusChange: (next: StatusFilter) => void;
  onClear: (field: "branch" | "event" | "actor") => void;
};

export function RunFilters({
  status = "all",
  branch,
  event,
  actor,
  onStatusChange,
  onClear,
}: RunFiltersProps) {
  const pinnedChips: Array<{ field: "branch" | "event" | "actor"; label: string; value: string }> =
    [
      branch && { field: "branch" as const, label: "branch", value: branch },
      event && { field: "event" as const, label: "event", value: event },
      actor && { field: "actor" as const, label: "actor", value: actor },
    ].filter((x): x is { field: "branch" | "event" | "actor"; label: string; value: string } =>
      Boolean(x),
    );

  return (
    <div className="flex items-center gap-1.5">
      <ToggleGroup
        type="single"
        value={status}
        onValueChange={(next) => {
          if (next) onStatusChange(next as StatusFilter);
        }}
        size="sm"
        variant="default"
        className="rounded-md"
      >
        {STATUS_OPTIONS.map((opt) => (
          <ToggleGroupItem
            key={opt.value}
            value={opt.value}
            className="h-6 rounded-md px-2 text-caption data-[state=on]:bg-background data-[state=on]:text-foreground"
          >
            {opt.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {pinnedChips.length > 0 ? (
        <span aria-hidden className="h-4 w-px self-center bg-border" />
      ) : null}

      {pinnedChips.map((c) => (
        <button
          key={c.field}
          type="button"
          onClick={() => onClear(c.field)}
          title={`Clear ${c.label} filter`}
          className={cn(
            "group inline-flex h-6 items-center gap-1 rounded-sm px-1.5",
            "bg-accent font-mono text-caption text-foreground outline-none",
            "focus-visible:ring-1 focus-visible:ring-(--color-focus)",
          )}
        >
          <span className="text-(--color-fg-faint)">{c.label}</span>
          <span>{c.value}</span>
          <X className="size-3 text-(--color-fg-faint) group-hover:text-foreground" />
        </button>
      ))}
    </div>
  );
}
