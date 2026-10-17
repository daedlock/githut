import { Search, X } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { RUN_STATUSES, type RunsFilters } from "../hooks";

type StatusFilter = NonNullable<RunsFilters["status"]> | "all";
export type RunFiltersProps = {
  status?: StatusFilter;
  branch?: string;
  event?: string;
  actor?: string;
  onStatusChange: (next: StatusFilter) => void;
  onFiltersChange: (filters: Pick<RunsFilters, "branch" | "event" | "actor">) => void;
  onClear: (field: "branch" | "event" | "actor") => void;
};

export function RunFilters({
  status = "all",
  branch,
  event,
  actor,
  onStatusChange,
  onFiltersChange,
  onClear,
}: RunFiltersProps) {
  return (
    <div className="w-full space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-caption text-muted-foreground">
          Status
          <select
            aria-label="Filter by status"
            value={status}
            onChange={(e) => onStatusChange(e.target.value as StatusFilter)}
            className="h-8 rounded-md border border-input bg-background px-2 text-ui text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">All statuses</option>
            {RUN_STATUSES.map((value) => (
              <option key={value} value={value}>
                {value === "in_progress"
                  ? "In progress"
                  : value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <form
          key={`${branch}-${event}-${actor}`}
          className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            onFiltersChange({
              branch: String(data.get("branch") ?? "").trim() || undefined,
              event: String(data.get("event") ?? "").trim() || undefined,
              actor: String(data.get("actor") ?? "").trim() || undefined,
            });
          }}
        >
          <input
            name="branch"
            aria-label="Filter by branch"
            placeholder="Branch"
            defaultValue={branch}
            className="h-8 w-28 min-w-24 flex-1 rounded-md border border-input bg-background px-2 text-ui"
          />
          <input
            name="event"
            aria-label="Filter by event"
            placeholder="Event"
            defaultValue={event}
            list="action-events"
            className="h-8 w-28 min-w-24 flex-1 rounded-md border border-input bg-background px-2 text-ui"
          />
          <datalist id="action-events">
            {[
              "push",
              "pull_request",
              "workflow_dispatch",
              "schedule",
              "workflow_run",
              "release",
            ].map((value) => (
              <option key={value} value={value} />
            ))}
          </datalist>
          <input
            name="actor"
            aria-label="Filter by actor"
            placeholder="Actor"
            defaultValue={actor}
            className="h-8 w-28 min-w-24 flex-1 rounded-md border border-input bg-background px-2 text-ui"
          />
          <Button type="submit" size="sm" variant="outline">
            <Search />
            Filter
          </Button>
        </form>
      </div>
      {branch || event || actor ? (
        <div className="flex flex-wrap gap-2">
          {(["branch", "event", "actor"] as const).map((field) => {
            const value = { branch, event, actor }[field];
            return value ? (
              <button
                key={field}
                type="button"
                onClick={() => onClear(field)}
                aria-label={`Clear ${field} filter`}
                className="inline-flex max-w-full items-center gap-2 rounded-md bg-accent px-2 py-1 text-caption"
              >
                <span className="text-muted-foreground">{field}</span>
                <span className="truncate">{value}</span>
                <X className="size-3 shrink-0" />
              </button>
            ) : null;
          })}
        </div>
      ) : null}
    </div>
  );
}
