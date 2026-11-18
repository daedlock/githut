import { useRef, useState } from "react";
import { Button } from "@/app/components/ui/button";
import { type Field, type Item, itemFieldValue, setField } from "./api";
import type { Run } from "./Task";

const DAY = 86400000;
const epoch = (date: string) => Math.floor(Date.parse(`${date}T00:00:00Z`) / DAY);
const iso = (day: number) => new Date(day * DAY).toISOString().slice(0, 10);
const format = (day: number) =>
  new Date(day * DAY).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
export function Roadmap({
  items,
  fields,
  projectId,
  canWrite,
  open,
  run,
}: {
  items: Item[];
  fields: Field[];
  projectId: string;
  canWrite: boolean;
  open: (i: Item) => void;
  run: Run;
}) {
  const dates = fields.filter((f) => f.dataType === "DATE");
  const [startId, setStart] = useState("");
  const [endId, setEnd] = useState("");
  const start =
    dates.find((f) => f.id === startId) ?? dates.find((f) => /start/i.test(f.name)) ?? dates[0];
  const end =
    dates.find((f) => f.id === endId && f.id !== start?.id) ??
    dates.find((f) => /target|end|due/i.test(f.name) && f.id !== start?.id) ??
    dates.find((f) => f.id !== start?.id);
  const today = Math.floor(Date.now() / DAY);
  const [center, setCenter] = useState(today);
  const [zoom, setZoom] = useState(30);
  const left = center - Math.floor(zoom / 2);
  const [retry, setRetry] = useState<{ itemId: string; field: Field; date: string } | null>(null);
  const drag = useRef<{ x: number; width: number; item: string; resize: boolean } | null>(null);
  function shift(i: Item, delta: number, resize = false) {
    const raw = start && itemFieldValue(i, start)?.date;
    const final = end && itemFieldValue(i, end)?.date;
    if (retry || !canWrite || !i.content?.id || (!raw && !final) || !delta) return;
    void run(async () => {
      if (resize && raw && final && epoch(final) + delta < epoch(raw))
        throw new Error("The target date must be on or after the start date.");
      if (raw && start && (!resize || !final))
        await setField(projectId, i.id, start, iso(epoch(raw) + delta));
      if (final && end) {
        const date = iso(epoch(final) + delta);
        try {
          await setField(projectId, i.id, end, date);
        } catch (error) {
          if (!resize && raw) setRetry({ itemId: i.id, field: end, date });
          throw error;
        }
      }
    }, "Schedule updated");
  }
  const periods = fields
    .flatMap((f) =>
      (f.configuration?.iterations ?? []).map((iter) => ({
        title: iter.title,
        from: epoch(iter.startDate),
        to: epoch(iter.startDate) + iter.duration - 1,
      })),
    )
    .filter((p) => p.to >= left && p.from < left + zoom);
  const milestones = new Map(
    items.flatMap((i) =>
      i.content?.milestone?.dueOn
        ? [[i.content.milestone.title, epoch(i.content.milestone.dueOn.slice(0, 10))] as const]
        : [],
    ),
  );
  return (
    <section>
      <div className="project-tools">
        <label>
          Start{" "}
          <select value={start?.id ?? ""} onChange={(e) => setStart(e.target.value)}>
            {dates.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Target{" "}
          <select value={end?.id ?? ""} onChange={(e) => setEnd(e.target.value)}>
            {dates
              .filter((f) => f.id !== start?.id)
              .map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
          </select>
        </label>
        <Button
          variant="ghost"
          aria-label="Previous period"
          onClick={() => setCenter(center - zoom)}
        >
          ←
        </Button>
        <Button variant="secondary" onClick={() => setCenter(today)}>
          Today
        </Button>
        <Button variant="ghost" aria-label="Next period" onClick={() => setCenter(center + zoom)}>
          →
        </Button>
        <select
          aria-label="Roadmap zoom"
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
        >
          <option value="7">Week</option>
          <option value="30">Month</option>
          <option value="90">Quarter</option>
        </select>
      </div>
      {retry && (
        <div role="status">
          Start saved. Target date still needs to be saved.{" "}
          <Button
            disabled={!canWrite}
            onClick={() =>
              run(async () => {
                await setField(projectId, retry.itemId, retry.field, retry.date);
                setRetry(null);
              }, "Schedule updated")
            }
          >
            Retry target date
          </Button>
        </div>
      )}
      {!dates.length && (
        <p className="project-muted">Create a date field in Settings to schedule tasks.</p>
      )}
      <div className="project-timeline">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(140px,28%) minmax(340px,1fr)",
            minWidth: 480,
          }}
        >
          <strong className="project-axis">Task</strong>
          <div className="flex justify-between text-caption" aria-live="polite">
            <span>{format(left)}</span>
            <span>{format(center)}</span>
            <span>{format(left + zoom - 1)}</span>
          </div>
          {periods.length > 0 && (
            <>
              <span className="project-axis">Iterations</span>
              <div className="project-track">
                {periods.map((p) => (
                  <span
                    className="project-period"
                    key={p.title + p.from}
                    style={{
                      left: `${(100 * Math.max(0, p.from - left)) / zoom}%`,
                      width:
                        (100 * (Math.min(left + zoom, p.to + 1) - Math.max(left, p.from))) / zoom +
                        "%",
                    }}
                    title={p.title}
                  >
                    {p.title}
                  </span>
                ))}
              </div>
            </>
          )}
          {Array.from(milestones)
            .filter(([, day]) => day >= left && day < left + zoom)
            .map(([name, day]) => (
              <div className="contents" key={name}>
                <span className="project-axis">{name}</span>
                <span className="project-track">
                  <span
                    className="project-period"
                    style={{ left: `${(100 * (day - left)) / zoom}%` }}
                  >
                    ◆ {format(day)}
                  </span>
                </span>
              </div>
            ))}
          {items.map((i) => {
            const a = start && itemFieldValue(i, start)?.date,
              b = end && itemFieldValue(i, end)?.date;
            const first = a || b,
              last = b || a;
            const from = first ? epoch(first) : 0,
              to = last ? epoch(last) : 0;
            const visible = first && to >= left && from < left + zoom;
            const label = i.content?.title ?? "Restricted item";
            return (
              <div key={i.id} className="contents">
                <button
                  type="button"
                  data-motion-item={i.id}
                  className="project-axis project-task"
                  onClick={() => open(i)}
                >
                  {label}
                </button>
                <div
                  className="project-track"
                  style={{ "--tick": `${100 / (zoom === 90 ? 13 : zoom)}%` } as React.CSSProperties}
                >
                  {visible ? (
                    <button
                      type="button"
                      className="project-bar"
                      aria-label={`${label} · ${first} to ${last}`}
                      title={`${first} – ${last}`}
                      style={{
                        left: `${(100 * Math.max(0, from - left)) / zoom}%`,
                        width:
                          (100 *
                            Math.max(1, Math.min(left + zoom, to + 1) - Math.max(left, from))) /
                            zoom +
                          "%",
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                          e.preventDefault();
                          shift(i, e.key === "ArrowLeft" ? -1 : 1, e.shiftKey);
                        }
                      }}
                      onPointerDown={(e) => {
                        drag.current = {
                          item: i.id,
                          x: e.clientX,
                          width: e.currentTarget.parentElement!.clientWidth,
                          resize:
                            !!b && e.clientX > e.currentTarget.getBoundingClientRect().right - 8,
                        };
                        e.currentTarget.setPointerCapture(e.pointerId);
                      }}
                      onPointerCancel={() => {
                        drag.current = null;
                      }}
                      onPointerUp={(e) => {
                        const d = drag.current;
                        drag.current = null;
                        if (d?.item === i.id)
                          shift(i, Math.round(((e.clientX - d.x) * zoom) / d.width), d.resize);
                      }}
                      onClick={(e) => {
                        if (!e.detail) open(i);
                      }}
                    >
                      {first}
                    </button>
                  ) : first ? (
                    <button type="button" className="text-caption" onClick={() => setCenter(from)}>
                      {format(from)} ↗
                    </button>
                  ) : (
                    <button type="button" className="text-caption" onClick={() => open(i)}>
                      Unscheduled · Set dates
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
