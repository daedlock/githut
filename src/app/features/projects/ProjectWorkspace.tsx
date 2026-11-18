import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CalendarDays, Columns3, FolderKanban, Table2 } from "lucide-react";
import { Fragment, useRef, useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/app/components/ui/dialog";
import { useCanMutate } from "@/app/lib/connectivity";
import { getGitHubClient } from "@/app/lib/github/client";
import { useRateLimitStore } from "@/app/stores/rateLimit";
import {
  displayValue,
  type Field,
  FieldConflict,
  type Item,
  itemFieldValue,
  mutate,
  projectPath,
  setField,
  storedValue,
  viewMembers,
  type Workspace,
  workspace,
} from "./api";
import { Insights } from "./Insights";
import { IterationPlan } from "./IterationPlan";
import { AddTask, Settings, Updates } from "./ProjectForms";
import { ProjectError } from "./ProjectsHome";
import { Roadmap } from "./Roadmap";
import { editable, FieldInput, type Run, Task } from "./Task";
import { useProjectMotion } from "./useProjectMotion";

type Search = { view?: string; item?: string };
const layoutIcons = { list: Table2, board: Columns3, roadmap: CalendarDays };
function repositoryValue(i: Item, f: Field) {
  const c = i.content;
  if (!c) return "";
  if (f.dataType === "ASSIGNEES") return c.assignees?.nodes.map((u) => u.login).join(", ");
  if (f.dataType === "LABELS") return c.labels?.nodes.map((l) => l.name).join(", ");
  if (f.dataType === "MILESTONE") return c.milestone?.title;
  if (f.dataType === "REPOSITORY") return c.repository?.nameWithOwner;
  return "";
}
const layouts = ["List", "Board", "Roadmap"] as const;
function TaskLink({ item, open }: { item: Item; open: (i: Item) => void }) {
  const c = item.content;
  return (
    <button type="button" className="project-task" onClick={() => open(item)}>
      {c?.title ?? "Restricted item"}
      <small>
        {c?.repository
          ? `${c.repository.nameWithOwner}#${c.number}`
          : c?.__typename === "DraftIssue"
            ? "Draft"
            : "Repository access required"}
      </small>
    </button>
  );
}
export function matchesFilter(item: Item, fields: Field[], filter: string) {
  const c = item.content;
  const text = [
    c?.title,
    c?.repository?.nameWithOwner,
    ...(c?.assignees?.nodes.map((a) => a.login) ?? []),
    ...(c?.labels?.nodes.map((l) => l.name) ?? []),
    ...item.fieldValues.nodes.map(displayValue),
  ]
    .join(" ")
    .toLowerCase();
  const tokens = filter.toLowerCase().match(/(?:[^\s"]|"[^"]*")+/g) ?? [];
  return tokens.every((token) => {
    const negative = token.startsWith("-");
    const word = (negative ? token.slice(1) : token).replaceAll('"', "");
    const colon = word.indexOf(":");
    let match = false;
    if (colon < 0) match = text.includes(word);
    else {
      const key = word.slice(0, colon),
        value = word.slice(colon + 1);
      const f = fields.find((f) => f.name.toLowerCase() === key);
      if (key === "is")
        match = [
          c?.state?.toLowerCase(),
          { Issue: "issue", PullRequest: "pr", DraftIssue: "draft" }[c?.__typename ?? "Issue"],
        ].includes(value);
      else if (key === "assignee")
        match = !!c?.assignees?.nodes.some((a) => a.login.toLowerCase() === value);
      else if (key === "label")
        match = !!c?.labels?.nodes.some((l) => l.name.toLowerCase() === value);
      else if (key === "repo") match = c?.repository?.nameWithOwner.toLowerCase() === value;
      else if (f) match = displayValue(itemFieldValue(item, f)).toLowerCase() === value;
    }
    return negative ? !match : match;
  });
}
export function ProjectWorkspace({
  kind,
  login,
  number,
  view,
  item,
  change,
}: Search & { kind: string; login: string; number: number; change: (p: Search) => void }) {
  const q = useQuery({
    queryKey: ["projects", "workspace", kind, login, number],
    queryFn: () => workspace(kind, login, number),
  });
  if (q.error && !q.data) return <ProjectError error={q.error} retry={() => q.refetch()} />;
  if (!q.data)
    return (
      <div className="projects-page" role="status">
        Loading project…
      </div>
    );
  return (
    <>
      <WorkspacePage data={q.data} view={view} item={item} change={change} />
      {q.error && <ProjectError error={q.error} retry={() => q.refetch()} />}
    </>
  );
}
function WorkspacePage({
  data,
  view = "list",
  item,
  change,
}: Search & { data: Workspace; change: (s: Search) => void }) {
  const { canMutate, reason } = useCanMutate();
  const reset = useRateLimitStore((s) =>
    Math.max(s.buckets.graphql?.pausedUntil ?? 0, s.buckets.core?.pausedUntil ?? 0),
  );
  const unavailable =
    reason ||
    (reset > Date.now()
      ? `GitHub rate limit reached. Retry after ${new Date(reset).toLocaleTimeString()}`
      : undefined);
  const { project, fields, items, views } = data;
  const qc = useQueryClient();
  const lock = useRef(false);
  const [conflict, setConflict] = useState<FieldConflict | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [filter, setFilter] = useState("");
  const [order, setOrder] = useState("");
  const [groupId, setGroup] = useState("");
  const [hiddenOverride, setHide] = useState<string[] | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [viewName, setName] = useState("");
  const [listGroup, setListGroup] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [undo, setUndo] = useState<{
    item: Item;
    field: Field;
    previous: string;
    replacement: string;
  } | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const saved = views.find((v) => String(v.number) === view);
  const hide =
    hiddenOverride ??
    (saved
      ? fields.filter((f) => !saved.fields.nodes.some((n) => n.id === f.id)).map((f) => f.id)
      : []);
  const members = useQuery({
    queryKey: ["projects", "view", project.id, saved?.number],
    enabled: !!saved,
    queryFn: () => viewMembers(project, saved!.number),
  });
  const layout = saved
    ? { TABLE_LAYOUT: "list", BOARD_LAYOUT: "board", ROADMAP_LAYOUT: "roadmap" }[saved.layout]
    : view;
  const motion = useProjectMotion(data, layout);
  const planning = ["list", "board", "roadmap", "archive"].includes(layout);
  const grouped = fields.filter((f) => f.options || f.configuration);
  const group =
    grouped.find((f) => f.id === (groupId || saved?.verticalGroupByFields.nodes[0]?.id)) ??
    grouped.find((f) => f.name === "Status") ??
    grouped[0];
  const options =
    group?.options ??
    (group?.configuration
      ? [...group.configuration.iterations, ...group.configuration.completedIterations].map(
          (i) => ({ id: i.id, name: i.title }),
        )
      : []);
  const [lift, setLift] = useState<{ itemId: string; column: number } | null>(null);
  const selected = items.find((i) => i.id === item);
  const byId = new Map(items.map((i) => [i.id, i]));
  const available = saved ? (members.data ?? []).flatMap((id) => byId.get(id) ?? []) : items;
  const shown = available.filter(
    (i) => i.isArchived === (layout === "archive") && matchesFilter(i, fields, filter),
  );
  if (order)
    shown.sort(
      (a, b) =>
        (a.content?.title ?? "").localeCompare(b.content?.title ?? "") * (order === "asc" ? 1 : -1),
    );
  const estimate = fields.find((f) => f.dataType === "NUMBER" && /estimate|points/i.test(f.name));
  const shownChecked = shown.filter((i) => checked.includes(i.id) && !!i.content?.id);
  const run: Run = async (work, message) => {
    if (unavailable || !canMutate) {
      setFeedback(unavailable || "Sign in to save changes.");
      return false;
    }
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setFeedback("Saving…");
    try {
      await work();
      motion.capture();
      await qc.invalidateQueries({ queryKey: ["projects"] });
      setFeedback(message);
      return true;
    } catch (e) {
      if (e instanceof FieldConflict) setConflict(e);
      setFeedback(e instanceof Error ? e.message : "Could not save. Retry the change.");
      await qc.invalidateQueries({ queryKey: ["projects"] });
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  function switchView(v: string) {
    setLift(null);
    setListGroup(null);
    setCollapsed([]);
    setUndo(null);
    setFilter("");
    setChecked([]);
    setHide(null);
    setOrder("");
    setGroup("");
    setFeedback("");
    change({ view: v, item: undefined });
  }
  function open(i: Item) {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    change({ item: i.id });
  }
  async function edit(i: Item, f: Field, v: string) {
    const before = shown.findIndex((r) => r.id === i.id);
    if (
      await run(
        () => setField(project.id, i.id, f, v, storedValue(itemFieldValue(i, f))),
        `${f.name} saved`,
      )
    ) {
      const fresh = qc
        .getQueriesData<Workspace>({ queryKey: ["projects", "workspace"] })
        .find(([, d]) => d?.project.id === project.id)?.[1]
        ?.items.find((r) => r.id === i.id);
      const memberList = saved
        ? qc.getQueryData<string[]>(["projects", "view", project.id, saved.number])
        : undefined;
      if (
        fresh &&
        (!matchesFilter(fresh, fields, filter) || (memberList && !memberList.includes(i.id)))
      ) {
        const old = itemFieldValue(i, f);
        setUndo({
          item: i,
          field: f,
          replacement: v,
          previous: old?.optionId ?? old?.iterationId ?? displayValue(old),
        });
        setFeedback(
          `Task remains in ${project.title}. Hidden by ${filter || saved?.filter || "this view"}.`,
        );
        requestAnimationFrame(() => {
          const next = shown[before + 1] ?? shown[before - 1];
          const row =
            next &&
            motion.root.current?.querySelector<HTMLElement>(`[data-item="${CSS.escape(next.id)}"]`);
          const target =
            row?.querySelector<HTMLElement>(
              `[aria-label="${CSS.escape(f.name)}"]:not(:disabled)`,
            ) ?? row?.querySelector<HTMLElement>(".project-task");
          (target || filterRef.current)?.focus();
        });
      }
    }
  }
  const listGroupId = listGroup ?? saved?.groupByFields.nodes[0]?.id ?? "";
  const grouping = grouped.find((f) => f.id === listGroupId);
  const buckets = new Map<string, Item[]>();
  for (const i of shown) {
    const key = grouping ? displayValue(itemFieldValue(i, grouping)) || `No ${grouping.name}` : "";
    const bucket = buckets.get(key) ?? [];
    bucket.push(i);
    buckets.set(key, bucket);
  }
  async function restore() {
    if (!undo) return;
    const { item, field, previous } = undo;
    if (
      await run(
        () => setField(project.id, item.id, field, previous, undo.replacement),
        `${field.name} restored`,
      )
    ) {
      setUndo(null);
      requestAnimationFrame(() =>
        filterRef.current
          ?.closest("section")
          ?.querySelector<HTMLButtonElement>(`[data-item="${CSS.escape(item.id)}"] .project-task`)
          ?.focus(),
      );
    }
  }
  const visibleCandidates = fields.filter(
    (f) => editable(f) || ["ASSIGNEES", "LABELS", "MILESTONE", "REPOSITORY"].includes(f.dataType),
  );
  const activeFields = visibleCandidates.filter((f) => !hide.includes(f.id));
  const disabled = busy || !!unavailable || !project.viewerCanUpdate;
  async function reorder(i: Item, direction: number) {
    if (order || saved || filter || grouping) {
      setFeedback("Choose the unfiltered List in project order to reorder tasks.");
      return;
    }
    const rows = items.filter((r) => !r.isArchived);
    const from = rows.findIndex((r) => r.id === i.id);
    const target = from + direction;
    if (target < 0 || target >= rows.length) return;
    const rest = rows.filter((r) => r.id !== i.id);
    await run(
      () =>
        mutate("updateProjectV2ItemPosition", {
          projectId: project.id,
          itemId: i.id,
          afterId: rest[target - 1]?.id ?? null,
        }),
      "Task reordered",
    );
  }
  return (
    <section
      aria-label={project.title}
      ref={motion.root}
      className="project-workspace"
      onKeyDown={(e) => {
        if (
          undo &&
          (e.metaKey || e.ctrlKey) &&
          e.key === "z" &&
          !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
        ) {
          e.preventDefault();
          void restore();
        }
      }}
    >
      <header className="project-header">
        <div>
          <Link to="/projects" className="project-eyebrow inline-flex items-center gap-1">
            <FolderKanban size={14} />
            Projects
          </Link>
          <h1>{project.title}</h1>
          <p className="project-muted">
            @{project.owner.login} · #{project.number} · {project.public ? "Public" : "Private"}
            {!project.viewerCanUpdate ? " · Read only" : ""}
          </p>
        </div>
        <AddTask project={project} run={run} busy={busy || !!unavailable} feedback={feedback} />
      </header>
      {unavailable && <p role="status">{unavailable}</p>}
      {project.closed && <p role="status">Closed project</p>}
      <nav className="project-tabs" aria-label="Project views">
        {[
          ...layouts.map((n) => [n.toLowerCase(), n]),
          ...views.map((v) => [String(v.number), v.name]),
          ...["Updates", "Insights", "Settings", "Archive"].map((n) => [n.toLowerCase(), n]),
        ].map(([id, label]) => {
          const Icon = layoutIcons[id as keyof typeof layoutIcons];
          return (
            <button
              type="button"
              key={id}
              aria-current={view === id ? "page" : undefined}
              onClick={() => switchView(id!)}
            >
              {Icon && <Icon size={14} />} {label}
            </button>
          );
        })}
      </nav>
      {saved && (
        <p className="project-muted">
          Shared view {saved.filter && `· ${saved.filter}`} ·{" "}
          <a className="underline" href={`${project.url}/views/${saved.number}`}>
            Edit shared view on GitHub
          </a>
        </p>
      )}
      {planning && (
        <div className="project-tools">
          <input
            ref={filterRef}
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter tasks…"
            aria-label="Filter tasks"
          />
          <select aria-label="Sort tasks" value={order} onChange={(e) => setOrder(e.target.value)}>
            <option value="">Project order</option>
            <option value="asc">Title A–Z</option>
            <option value="desc">Title Z–A</option>
          </select>
          {layout === "board" && (
            <select
              aria-label="Group board by"
              value={group?.id ?? ""}
              onChange={(e) => setGroup(e.target.value)}
            >
              {grouped.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          )}
          {layout === "list" && (
            <select
              value={listGroupId}
              aria-label="Group list by"
              onChange={(e) => setListGroup(e.target.value)}
            >
              <option value="">No grouping</option>
              {grouped.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          )}
          {layout === "list" && (
            <details>
              <summary>Fields</summary>
              {visibleCandidates.map((f) => (
                <label className="block" key={f.id}>
                  <input
                    type="checkbox"
                    checked={!hide.includes(f.id)}
                    onChange={() =>
                      setHide(
                        hide.includes(f.id) ? hide.filter((id) => id !== f.id) : [...hide, f.id],
                      )
                    }
                  />{" "}
                  {f.name}
                </label>
              ))}
            </details>
          )}
          {layout !== "archive" && (
            <Dialog open={saving} onOpenChange={setSaving}>
              <DialogTrigger asChild>
                <Button size="sm" variant="ghost" disabled={disabled}>
                  Save as new view
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogTitle>New shared view</DialogTitle>
                <form
                  className="project-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(async () => {
                      const client = getGitHubClient();
                      let path = projectPath(project);
                      if (project.owner.__typename === "User") {
                        const { data: user } = await client.request("GET /users/{username}", {
                          username: project.owner.login,
                        });
                        path = `/users/${user.id}/projectsV2/${project.number}`;
                      }
                      const result = await client.request(`POST ${path}/views`, {
                        name: viewName.trim(),
                        layout: layout === "list" ? "table" : layout,
                        filter: [saved?.filter, filter].filter(Boolean).join(" "),
                        ...(layout !== "roadmap"
                          ? {
                              visible_fields: fields
                                .filter((f) => !hide.includes(f.id) && f.databaseId)
                                .map((f) => f.databaseId),
                            }
                          : {}),
                        ...(order && fields.find((f) => f.dataType === "TITLE")?.databaseId
                          ? {
                              sort_by: [
                                [fields.find((f) => f.dataType === "TITLE")!.databaseId, order],
                              ],
                            }
                          : {}),
                        ...(grouping?.databaseId && layout === "list"
                          ? { group_by: [grouping.databaseId] }
                          : {}),
                        ...(group?.databaseId && layout === "board"
                          ? { vertical_group_by: [group.databaseId] }
                          : {}),
                      });
                      setSaving(false);
                      setName("");
                      switchView(String(result.data.number));
                    }, "View saved");
                  }}
                >
                  <label>
                    View name
                    <input required value={viewName} onChange={(e) => setName(e.target.value)} />
                  </label>
                  <Button disabled={!viewName.trim() || busy}>Create shared view</Button>
                  <p role="status">{feedback}</p>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      )}
      <p className="project-muted" role="status" aria-live="polite">
        {feedback || (planning ? `${shown.length} tasks` : "")}
      </p>
      {planning && (filter || order || hiddenOverride || listGroup !== null || groupId) && (
        <div className="project-tools">
          <span>Unsaved changes · Only you see them</span>
          <Button size="sm" variant="ghost" onClick={() => switchView(view)}>
            Reset
          </Button>
        </div>
      )}
      {undo && (
        <div className="project-tools">
          <Button size="sm" disabled={busy} onClick={restore}>
            Undo
          </Button>
          <Button size="sm" variant="ghost" onClick={() => open(undo.item)}>
            Open item
          </Button>
        </div>
      )}
      {saved && members.isError ? (
        <ProjectError error={members.error} retry={() => members.refetch()} />
      ) : saved && members.isPending ? (
        <p>Loading saved view…</p>
      ) : (
        <>
          {(layout === "list" || layout === "archive") && (
            <>
              <div className="project-tablewrap">
                <table className="project-table">
                  <thead>
                    <tr>
                      <th>
                        <span className="sr-only">Select</span>
                      </th>
                      <th>Title</th>
                      {activeFields.map((f) => (
                        <th key={f.id}>{f.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(buckets, ([key, rows]) => (
                      <Fragment key={key}>
                        {key && (
                          <tr>
                            <th colSpan={2 + activeFields.length}>
                              <button
                                type="button"
                                aria-expanded={!collapsed.includes(key)}
                                onClick={() =>
                                  setCollapsed(
                                    collapsed.includes(key)
                                      ? collapsed.filter((k) => k !== key)
                                      : [...collapsed, key],
                                  )
                                }
                              >
                                {collapsed.includes(key) ? "▸" : "▾"} {key} · {rows.length}
                              </button>
                              <IterationPlan
                                projectId={project.id}
                                field={grouping}
                                title={key}
                                items={rows}
                                estimate={estimate}
                              />
                            </th>
                          </tr>
                        )}
                        {!collapsed.includes(key) &&
                          rows.map((i) => (
                            <tr
                              key={i.id}
                              data-motion-item={i.id}
                              data-item={i.id}
                              onKeyDown={(e) => {
                                if (
                                  !disabled &&
                                  i.content?.id &&
                                  e.altKey &&
                                  (e.key === "ArrowUp" || e.key === "ArrowDown")
                                ) {
                                  e.preventDefault();
                                  void reorder(i, e.key === "ArrowUp" ? -1 : 1);
                                }
                              }}
                            >
                              <td>
                                <input
                                  type="checkbox"
                                  aria-label={`Select ${i.content?.title ?? "item"}`}
                                  disabled={disabled || !i.content?.id}
                                  checked={checked.includes(i.id)}
                                  onChange={(e) =>
                                    setChecked(
                                      e.target.checked
                                        ? [...checked, i.id]
                                        : checked.filter((k) => k !== i.id),
                                    )
                                  }
                                />
                              </td>
                              <td>
                                <TaskLink item={i} open={open} />
                              </td>
                              {activeFields.map((f) => (
                                <td key={f.id} data-label={f.name}>
                                  {editable(f) ? (
                                    <FieldInput
                                      item={i}
                                      field={f}
                                      disabled={disabled || !i.content?.id}
                                      save={(v) => void edit(i, f, v)}
                                    />
                                  ) : (
                                    <span>{repositoryValue(i, f) || "—"}</span>
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              {shownChecked.length > 0 && (
                <div className="project-tools">
                  <span>{shownChecked.length} selected</span>
                  {group && (
                    <select
                      aria-label={`Set ${group.name} for selection`}
                      value=""
                      disabled={disabled}
                      onChange={(e) => {
                        const v = e.target.value;
                        void run(async () => {
                          for (const i of shownChecked)
                            await setField(
                              project.id,
                              i.id,
                              group,
                              v,
                              storedValue(itemFieldValue(i, group)),
                            );
                          setChecked([]);
                        }, "Selected tasks updated");
                      }}
                    >
                      <option value="">Set {group.name}…</option>
                      {options.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <Button
                    disabled={disabled}
                    onClick={() =>
                      run(async () => {
                        for (const i of shownChecked)
                          await mutate(
                            i.isArchived ? "unarchiveProjectV2Item" : "archiveProjectV2Item",
                            { projectId: project.id, itemId: i.id },
                          );
                        setChecked([]);
                      }, "Selection updated")
                    }
                  >
                    {layout === "archive" ? "Restore" : "Archive"} selected
                  </Button>
                </div>
              )}
            </>
          )}
          {layout === "board" && (
            <div className="project-board">
              {[{ id: "", name: group ? `No ${group.name}` : "Tasks" }, ...options].map((o) => {
                const cards = shown.filter((i) => {
                  const v = group && itemFieldValue(i, group);
                  return (v?.optionId ?? v?.iterationId ?? "") === o.id;
                });
                return (
                  <section
                    aria-label={o.name}
                    key={o.id}
                    className="project-column"
                    onDragOver={(e) => {
                      if (!disabled) e.preventDefault();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const i = byId.get(
                        e.dataTransfer.getData("application/x-githut-project-item"),
                      );
                      if (group && i?.content?.id && !disabled) void edit(i, group, o.id);
                    }}
                  >
                    <h3>
                      {o.name} · {cards.length}
                    </h3>
                    <IterationPlan
                      projectId={project.id}
                      field={group}
                      title={o.name}
                      items={cards}
                      estimate={estimate}
                    />
                    {cards.map((i) => (
                      <article
                        key={i.id}
                        className="project-card"
                        data-motion-item={i.id}
                        data-item={i.id}
                        data-lifted={lift?.itemId === i.id || undefined}
                        onKeyDown={(e) => {
                          if (
                            disabled ||
                            !i.content?.id ||
                            !group ||
                            !(e.target instanceof HTMLButtonElement)
                          )
                            return;
                          const columns = ["", ...options.map((o) => o.id)];
                          if (e.key === " ") {
                            e.preventDefault();
                            if (!lift) {
                              setLift({ itemId: i.id, column: columns.indexOf(o.id) });
                              setFeedback(
                                "Task lifted. Choose a column with the arrow keys, then press Space to drop.",
                              );
                            } else if (lift.itemId === i.id) {
                              void edit(i, group, columns[lift.column]!);
                              setLift(null);
                            }
                          } else if (
                            lift?.itemId === i.id &&
                            ["ArrowLeft", "ArrowRight", "Escape"].includes(e.key)
                          ) {
                            e.preventDefault();
                            if (e.key === "Escape") {
                              setLift(null);
                              setFeedback("Move cancelled.");
                            } else {
                              const column = Math.min(
                                columns.length - 1,
                                Math.max(0, lift.column + (e.key === "ArrowLeft" ? -1 : 1)),
                              );
                              setLift({ itemId: i.id, column });
                              setFeedback(`Move to ${options[column - 1]?.name ?? "No value"}`);
                            }
                          }
                        }}
                        draggable={!disabled && !!i.content?.id}
                        onDragStart={(e) =>
                          e.dataTransfer.setData("application/x-githut-project-item", i.id)
                        }
                      >
                        <TaskLink item={i} open={open} />
                        {group && (
                          <FieldInput
                            item={i}
                            field={group}
                            disabled={disabled || !i.content?.id}
                            save={(v) => void edit(i, group, v)}
                          />
                        )}
                      </article>
                    ))}
                    <AddTask
                      project={project}
                      group={group ? { field: group, value: o.id } : undefined}
                      run={run}
                      busy={busy || !!unavailable}
                      feedback={feedback}
                    />
                  </section>
                );
              })}
            </div>
          )}
          {layout === "roadmap" && (
            <Roadmap
              items={shown}
              fields={fields}
              projectId={project.id}
              canWrite={!disabled}
              run={run}
              open={open}
            />
          )}
          {planning && shown.length === 0 && (
            <p className="project-empty">
              {filter ? "No matching tasks." : "No tasks in this view."}
            </p>
          )}
          {layout === "insights" && <Insights data={data} />}{" "}
          {layout === "updates" && (
            <Updates project={project} run={run} busy={busy || !!unavailable} />
          )}{" "}
          {layout === "settings" && <Settings data={data} run={run} busy={busy || !!unavailable} />}
        </>
      )}
      {selected && (
        <Task
          key={selected.id + selected.content?.__typename}
          item={selected}
          project={project}
          fields={fields}
          run={run}
          busy={busy || !!unavailable}
          feedback={feedback}
          close={() => {
            change({ item: undefined });
            requestAnimationFrame(() => {
              const target = opener.current?.isConnected ? opener.current : filterRef.current;
              target?.focus();
            });
          }}
        />
      )}
      {conflict && (
        <Dialog
          open
          onOpenChange={(v) => {
            if (!v) setConflict(null);
          }}
        >
          <DialogContent>
            <DialogTitle>{conflict.field.name} changed on GitHub</DialogTitle>
            <p>GitHub now · {displayValue(conflict.current) || "Empty"}</p>
            <p>
              Your change ·{" "}
              {conflict.field.options?.find((o) => o.id === conflict.requested)?.name ??
                conflict.field.configuration?.iterations.find((i) => i.id === conflict.requested)
                  ?.title ??
                (conflict.requested || "Empty")}
            </p>
            <Button
              disabled={busy}
              onClick={async () => {
                const ok = await run(
                  () =>
                    setField(
                      project.id,
                      conflict.itemId,
                      conflict.field,
                      conflict.requested,
                      storedValue(conflict.current),
                    ),
                  "Change saved",
                );
                if (ok) setConflict(null);
              }}
            >
              Save mine
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setConflict(null);
                setFeedback("Kept GitHub’s value");
              }}
            >
              Use GitHub’s value
            </Button>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}
