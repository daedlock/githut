import { X } from "lucide-react";
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
    <div className="flex items-center gap-0.5">
      {STATUS_OPTIONS.map((opt) => {
        const isActive = status === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onStatusChange(opt.value)}
            className={cn(
              "h-6 px-2 rounded-sm font-sans text-caption font-medium outline-none",
              "focus-visible:ring-1 focus-visible:ring-(--color-focus)",
              isActive
                ? "bg-(--color-bg-sunken) text-foreground"
                : "text-muted-foreground hover:bg-(--color-bg-sunken) hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        );
      })}

      {pinnedChips.length > 0 ? (
        <span aria-hidden className="mx-1 h-4 w-px bg-border self-center" />
      ) : null}

      {pinnedChips.map((c) => (
        <button
          key={c.field}
          type="button"
          onClick={() => onClear(c.field)}
          title={`Clear ${c.label} filter`}
          className={cn(
            "group inline-flex h-6 items-center gap-1 rounded-sm px-1.5",
            "bg-(--color-bg-sunken) font-mono text-caption text-foreground outline-none",
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
