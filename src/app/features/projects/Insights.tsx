import { useId, useState } from "react";
import { displayValue, itemFieldValue, type Workspace } from "./api";
export function Insights({ data }: { data: Workspace }) {
  const iteration = data.fields.find((f) => f.configuration);
  const iterations = iteration?.configuration
    ? [...iteration.configuration.iterations, ...iteration.configuration.completedIterations]
    : [];
  const today = new Date().toISOString().slice(0, 10);
  const day = 86400000;
  const [selected, setSelected] = useState(
    () =>
      iterations.find(
        (i) =>
          i.startDate <= today && Date.parse(i.startDate) + i.duration * day > Date.parse(today),
      )?.id ?? "",
  );
  const period = iterations.find((i) => i.id === selected);
  const active = data.items.filter(
    (i) =>
      !i.isArchived &&
      (!period || (iteration && itemFieldValue(i, iteration)?.iterationId === period.id)),
  );
  const status = data.fields.find((f) => f.name === "Status");
  const estimate = data.fields.find(
    (f) => f.dataType === "NUMBER" && /estimate|points/i.test(f.name),
  );
  const points = (i: (typeof active)[number]) =>
    estimate ? (itemFieldValue(i, estimate)?.number ?? 0) : 1;
  const counts = new Map<string, number>();
  for (const item of active) {
    const s = (status && displayValue(itemFieldValue(item, status))) || "No status";
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  const end = period
    ? Date.parse(period.startDate) + (period.duration - 1) * day
    : Date.parse(today);
  const start = period ? Date.parse(period.startDate) : end - 27 * day;
  const series = Array.from({ length: Math.max(1, Math.ceil((end - start) / day) + 1) }, (_, k) => {
    const date = new Date(start + day * k).toISOString().slice(0, 10);
    const scope = active.filter((i) => i.createdAt?.slice(0, 10) <= date);
    return {
      date,
      scope: scope.reduce((n, i) => n + points(i), 0),
      done: scope.reduce(
        (n, i) =>
          n + (i.content?.closedAt && i.content.closedAt.slice(0, 10) <= date ? points(i) : 0),
        0,
      ),
    };
  }).filter((t) => t.date <= today);
  const maximum = Math.max(1, ...series.map((v) => v.scope));
  const line = (key: "scope" | "done") =>
    series
      .map(
        (v, i) =>
          `${10 + (580 * i) / Math.max(1, series.length - 1)},${130 - (120 * v[key]) / maximum}`,
      )
      .join(" ");
  const chart = useId();
  return (
    <section>
      <h2>Insights</h2>
      <div className="project-tools">
        <label>
          Iteration{" "}
          <select value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">All iterations</option>
            {iterations.map((i) => (
              <option key={i.id} value={i.id}>
                {i.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="project-metrics">
        <div>
          <strong>{active.length}</strong>Active tasks
        </div>
        <div>
          <strong>
            {
              active.filter((i) => i.content?.state === "CLOSED" || i.content?.state === "MERGED")
                .length
            }
          </strong>
          Completed tasks
        </div>
        {estimate && (
          <>
            <div>
              <strong>
                {active.filter((i) => i.content?.closedAt).reduce((n, i) => n + points(i), 0)}
              </strong>
              Completed points
            </div>
            <div>
              <strong>
                {active.filter((i) => itemFieldValue(i, estimate)?.number == null).length}
              </strong>
              Missing estimate
            </div>
          </>
        )}
      </div>
      <h3 className="mt-6">Burn-up · {estimate ? "Points" : "Tasks"}</h3>
      <p className="project-muted">
        Current items and estimates, plotted by date added and date closed.
      </p>
      {series.length ? (
        <>
          <svg
            style={{ width: "100%", maxWidth: 720, height: 150 }}
            viewBox="0 0 600 140"
            role="img"
            aria-labelledby={chart}
          >
            <title id={chart}>
              Scope and completed work from {series[0]!.date} to {series.at(-1)!.date}
            </title>
            <polyline
              fill="none"
              stroke="var(--color-fg-muted)"
              strokeDasharray="5 4"
              strokeWidth="2"
              points={line("scope")}
            />
            <polyline
              fill="none"
              stroke="var(--color-brand)"
              strokeWidth="3"
              points={line("done")}
            />
          </svg>
          <details>
            <summary>View daily scope and completed work</summary>
            <table className="project-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Scope (dashed)</th>
                  <th>Completed (solid)</th>
                </tr>
              </thead>
              <tbody>
                {series.map((d) => (
                  <tr key={d.date}>
                    <td>{d.date}</td>
                    <td>{d.scope}</td>
                    <td>{d.done}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      ) : (
        <p>This iteration has not started.</p>
      )}
      <h3 className="mt-6">Tasks by status</h3>
      {Array.from(counts, ([name, count]) => (
        <div className="flex items-center gap-3 py-1" key={name}>
          <span>{name}</span>
          <meter aria-label={name} min={0} max={active.length} value={count} />
          <span>{count}</span>
        </div>
      ))}
      <a href={`${data.project.url}/insights`} className="underline">
        Saved GitHub charts
      </a>
    </section>
  );
}
