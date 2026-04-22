import { X } from "lucide-react";
import { cn } from "@/app/lib/cn";

// ─── Filters bar ───────────────────────────────────────────────────────────
//
// URL-driven: reads the active filters from props and emits intents back to
// the parent, which updates search params. No local state. Back/forward work.

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
  /** Total count rendered after these filters apply. Null while loading. */
  resultCount: number | null;
  onStatusChange: (next: StatusFilter) => void;
  onClearAll: () => void;
};

export function RunFilters({
  status = "all",
  branch,
  event,
  actor,
  resultCount,
  onStatusChange,
  onClearAll,
}: RunFiltersProps) {
  const chips = [
    branch && { label: "Branch", value: branch },
    event && { label: "Event", value: event },
    actor && { label: "Actor", value: actor },
  ].filter((x): x is { label: string; value: string } => Boolean(x));

  const hasExplicitFilter = status !== "all" || chips.length > 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onStatusChange(opt.value)}
            className={cn(
              "h-6 rounded-full px-2.5 font-sans text-caption font-medium outline-none",
              "transition-colors focus-visible:ring-1 focus-visible:ring-(--color-focus)",
              status === opt.value
                ? "bg-(--color-bg-sunken) text-foreground"
                : "text-muted-foreground hover:bg-(--color-bg-sunken) hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        ))}

        {/* Read-only chips for filters that currently only arrive via URL.
           Edits come through navigation (e.g. click a branch or actor anywhere
           to set the filter). A trailing × clears the chip. */}
        {chips.map((c) => (
          <span
            key={c.label}
            className={cn(
              "inline-flex h-6 items-center gap-1 rounded-full px-2.5",
              "bg-(--color-bg-sunken) font-mono text-caption text-foreground",
            )}
          >
            <span className="text-muted-foreground">{c.label}:</span>
            <span>{c.value}</span>
          </span>
        ))}

        {hasExplicitFilter ? (
          <button
            type="button"
            onClick={onClearAll}
            className={cn(
              "inline-flex h-6 items-center gap-1 rounded-full px-2",
              "font-sans text-caption text-muted-foreground outline-none",
              "transition-colors hover:text-foreground",
              "focus-visible:ring-1 focus-visible:ring-(--color-focus)",
            )}
          >
            <X className="size-3" />
            Clear
          </button>
        ) : null}

        <span className="ml-auto font-mono text-caption tabular-nums text-muted-foreground">
          {resultCount === null ? "…" : `${resultCount} ${resultCount === 1 ? "run" : "runs"}`}
        </span>
      </div>
    </div>
  );
}
