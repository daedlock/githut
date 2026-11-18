import { useState } from "react";
import { useAuthStore } from "@/app/stores/auth";
import { type Field, type Item, itemFieldValue } from "./api";

export function IterationPlan({
  projectId,
  field,
  title,
  items,
  estimate,
}: {
  projectId: string;
  field?: Field;
  title: string;
  items: Item[];
  estimate?: Field;
}) {
  const config = field?.configuration;
  const iteration =
    config && [...config.iterations, ...config.completedIterations].find((i) => i.title === title);
  const account = useAuthStore((s) => s.accountId);
  const key =
    account && iteration
      ? `githut.capacity.${account}.${projectId}.${field?.id}.${iteration.id}`
      : null;
  const [capacity, setCapacity] = useState(() => {
    try {
      return key ? (localStorage.getItem(key) ?? "") : "";
    } catch {
      return "";
    }
  });
  if (!iteration) return null;
  const end = new Date(Date.parse(iteration.startDate) + 86400000 * (iteration.duration - 1))
    .toISOString()
    .slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const points = items.reduce(
    (n, i) => n + (estimate ? (itemFieldValue(i, estimate)?.number ?? 0) : 1),
    0,
  );
  return (
    <div className="project-iteration">
      <span>
        {iteration.startDate} – {end}
        {today >= iteration.startDate && today <= end ? " · Current" : ""}
      </span>
      <span>
        {points}
        {capacity ? ` / ${capacity}` : ""} {estimate ? "points" : "tasks"}
      </span>
      {Number(capacity) > 0 && (
        <meter aria-label="Planned capacity" value={points} min={0} max={Number(capacity)} />
      )}
      <details>
        <summary>Capacity</summary>
        <label>
          Capacity on this device{" "}
          <input
            type="number"
            min={1}
            value={capacity}
            onChange={(e) => {
              const v = e.target.value;
              if (v && Number(v) < 1) return;
              setCapacity(v);
              try {
                if (key) localStorage.setItem(key, v);
              } catch {
                /* The in-memory preference still applies. */
              }
            }}
          />
        </label>
      </details>
    </div>
  );
}
