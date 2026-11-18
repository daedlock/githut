import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/app/components/ui/dialog";
import { getGitHubClient } from "@/app/lib/github/client";
import { useAuthStore } from "@/app/stores/auth";
import {
  type Field,
  graph,
  issueRef,
  linkedRepositories,
  mutate,
  type Project,
  repositoryId,
  setField,
  updates,
  type Workspace,
  workflows,
} from "./api";
import { ConfirmAction } from "./ConfirmAction";
import { ProjectError } from "./ProjectsHome";
import type { Run } from "./Task";

export function AddTask({
  project,
  group,
  run,
  busy,
  feedback,
}: {
  project: Project;
  group?: { field: Field; value: string };
  run: Run;
  busy: boolean;
  feedback: string;
}) {
  const account = useAuthStore((s) => s.accountId);
  const storageKey = account
    ? `githut.projects.add.${account}.${project.id}.${group?.field.id ?? ""}.${group?.value ?? ""}`
    : null;
  const [initial] = useState(() => {
    try {
      return JSON.parse((storageKey && sessionStorage.getItem(storageKey)) || "null") as {
        mode: string;
        title: string;
        repoName: string;
        contentId: string;
        itemId: string;
      } | null;
    } catch {
      return null;
    }
  });
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(initial?.mode ?? "draft");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [repoName, setRepoName] = useState(initial?.repoName ?? "");
  const [contentId, setContentId] = useState(initial?.contentId ?? "");
  const [itemId, setItemId] = useState(initial?.itemId ?? "");
  function remember(contentId: string, itemId: string) {
    try {
      if (storageKey)
        sessionStorage.setItem(
          storageKey,
          JSON.stringify({ mode, title, repoName, contentId, itemId }),
        );
    } catch {
      /* Keep recovery in memory when storage is unavailable. */
    }
  }
  function finish() {
    try {
      if (storageKey) sessionStorage.removeItem(storageKey);
    } catch {}
    setContentId("");
    setItemId("");
    setTitle("");
    setOpen(false);
  }
  const partial = !!(contentId || itemId);
  async function save() {
    let member = itemId;
    if (!member) {
      if (mode === "draft") {
        const res = await mutate<{ projectItem: { id: string } }>(
          "addProjectV2DraftIssue",
          { projectId: project.id, title: title.trim() },
          "projectItem{id}",
        );
        member = res.projectItem.id;
      } else {
        let id = contentId;
        if (!id) {
          if (mode === "existing") id = (await issueRef(title)).node_id;
          else {
            const [owner, repo, extra] = repoName.trim().split("/");
            if (!owner || !repo || extra) throw new Error("Enter owner/repo.");
            id = (
              await getGitHubClient().request("POST /repos/{owner}/{repo}/issues", {
                owner,
                repo,
                title: title.trim(),
              })
            ).data.node_id;
          }
          remember(id, "");
          setContentId(id);
        }
        const res = await mutate<{ item: { id: string } }>(
          "addProjectV2ItemById",
          { projectId: project.id, contentId: id },
          "item{id}",
        );
        member = res.item.id;
      }
      remember(contentId, member);
      setItemId(member);
    }
    if (group?.value) await setField(project.id, member, group.field, group.value);
    finish();
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant={group ? "ghost" : "secondary"}
          disabled={!project.viewerCanUpdate || busy}
        >
          {partial ? "Resume adding task" : "+ Add task"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Add task{group?.value ? " to column" : ""}</DialogTitle>
        <form
          className="project-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run(save, "Task added");
          }}
        >
          <label>
            Task type
            <select
              value={mode}
              disabled={partial || busy}
              onChange={(e) => setMode(e.target.value)}
            >
              <option value="draft">Project draft</option>
              <option value="existing">Existing issue or pull request</option>
              <option value="issue">New repository issue</option>
            </select>
          </label>
          {mode === "issue" && (
            <label>
              Repository
              <input
                disabled={partial || busy}
                required
                placeholder="owner/repo"
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
              />
            </label>
          )}
          <label>
            {mode === "existing" ? "Issue or pull request reference" : "Title"}
            <input
              disabled={partial || busy}
              required
              value={title}
              placeholder={mode === "existing" ? "owner/repo#123" : undefined}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          {partial && (
            <p>
              {itemId
                ? "Item added. Its column still needs to be saved."
                : "Repository item ready. Project membership still needs to be saved."}
            </p>
          )}
          <p role="status">{feedback}</p>
          <Button disabled={busy || !title.trim()}>
            {partial ? "Retry unfinished step" : "Add task"}
          </Button>
          {partial && (
            <Button type="button" variant="ghost" disabled={busy} onClick={finish}>
              Keep completed steps and dismiss
            </Button>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
export function Updates({ project, run, busy }: { project: Project; run: Run; busy: boolean }) {
  const q = useQuery({
    queryKey: ["projects", "updates", project.id],
    queryFn: () => updates(project.id),
  });
  const [target, setTarget] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("ON_TRACK");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  return (
    <section className="project-form">
      <h2>Status updates</h2>
      {project.viewerCanUpdate && (
        <form
          className="project-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await mutate("createProjectV2StatusUpdate", {
                projectId: project.id,
                body,
                status,
                startDate: date,
                targetDate: target || undefined,
              });
              setBody("");
            }, "Update published");
          }}
        >
          <label>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {["ON_TRACK", "AT_RISK", "OFF_TRACK", "COMPLETE", "INACTIVE"].map((s) => (
                <option key={s} value={s}>
                  {s.toLowerCase().replace("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label>
            Date
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>
            Target date
            <input
              type="date"
              min={date}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </label>
          <label>
            Update
            <textarea required value={body} onChange={(e) => setBody(e.target.value)} />
          </label>
          <Button disabled={busy || !body.trim()}>Publish update</Button>
        </form>
      )}
      {q.error ? (
        <ProjectError error={q.error} />
      ) : q.isPending ? (
        <p>Loading updates…</p>
      ) : q.data?.length ? (
        q.data.map((u) => (
          <article key={u.id}>
            <strong>
              {u.status?.replace("_", " ")} · {u.startDate ?? u.createdAt.slice(0, 10)}
              {u.targetDate ? ` – ${u.targetDate}` : ""}
            </strong>
            <p className="whitespace-pre-wrap">{u.body}</p>
          </article>
        ))
      ) : (
        <p>No updates yet.</p>
      )}
    </section>
  );
}
export function Settings({ data, run, busy }: { data: Workspace; run: Run; busy: boolean }) {
  const p = data.project;
  const navigate = useNavigate();
  const [fieldId, chooseField] = useState("");
  const [fieldName, setFieldName] = useState("");
  const chosen = data.fields.find((f) => f.id === fieldId);
  const [title, setTitle] = useState(p.title);
  const [description, setDescription] = useState(p.shortDescription ?? "");
  const [readme, setReadme] = useState(p.readme ?? "");
  const [name, setName] = useState("");
  const [type, setType] = useState("TEXT");
  const [opts, setOpts] = useState("");
  const [repo, setRepo] = useState("");
  const [login, setLogin] = useState("");
  const [role, setRole] = useState("READER");
  const [days, setDays] = useState(14);
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  const repos = useQuery({
    queryKey: ["projects", "repositories", p.id],
    queryFn: () => linkedRepositories(p.id),
  });
  const rules = useQuery({
    queryKey: ["projects", "workflows", p.id],
    queryFn: () => workflows(p.id),
  });
  const disabled = busy || !p.viewerCanUpdate;
  return (
    <div className="project-form">
      <h2>Project settings</h2>
      <label>
        Name
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label>
        Description
        <input value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <label>
        README
        <textarea value={readme} onChange={(e) => setReadme(e.target.value)} />
      </label>
      <Button
        disabled={disabled || !title.trim()}
        onClick={() =>
          run(
            () =>
              mutate("updateProjectV2", {
                projectId: p.id,
                title: title.trim(),
                shortDescription: description,
                readme,
              }),
            "Settings saved",
          )
        }
      >
        Save settings
      </Button>
      <h3>Fields and iterations</h3>
      <ul>
        {data.fields.map((f) => (
          <li key={f.id}>
            {f.name} · {f.dataType.toLowerCase().replaceAll("_", " ")}
          </li>
        ))}
      </ul>
      <details>
        <summary>Edit a field</summary>
        <label>
          Field
          <select
            value={fieldId}
            onChange={(e) => {
              chooseField(e.target.value);
              setFieldName(data.fields.find((f) => f.id === e.target.value)?.name ?? "");
            }}
          >
            <option value="">Choose field</option>
            {data.fields
              .filter((f) =>
                ["TEXT", "NUMBER", "DATE", "ITERATION", "SINGLE_SELECT"].includes(f.dataType),
              )
              .map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
          </select>
        </label>
        {chosen && (
          <>
            <label>
              Field name
              <input value={fieldName} onChange={(e) => setFieldName(e.target.value)} />
            </label>
            <Button
              disabled={disabled || !fieldName.trim()}
              onClick={() =>
                run(
                  () => mutate("updateProjectV2Field", { fieldId, name: fieldName.trim() }),
                  "Field renamed",
                )
              }
            >
              Rename field
            </Button>
            <p>{chosen.options?.map((o) => o.name).join(" · ")}</p>
            {chosen.configuration?.iterations.map((i) => (
              <p key={i.id}>
                {i.title} · {i.startDate} · {i.duration} days
              </p>
            ))}
            <a className="underline" href={`${p.url}/settings`}>
              Edit options and iteration schedule on GitHub
            </a>
            <ConfirmAction
              label="Delete field"
              subject={chosen.name}
              detail="GitHub will remove this field and its values from every item in this project."
              disabled={disabled}
              perform={() =>
                run(() => mutate("deleteProjectV2Field", { fieldId }), "Field deleted")
              }
            />
          </>
        )}
      </details>
      <label>
        New field name
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        Type
        <select value={type} onChange={(e) => setType(e.target.value)}>
          {["TEXT", "NUMBER", "DATE", "SINGLE_SELECT", "ITERATION"].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      {type === "SINGLE_SELECT" && (
        <label>
          Options, separated by commas
          <input value={opts} onChange={(e) => setOpts(e.target.value)} />
        </label>
      )}
      {type === "ITERATION" && (
        <>
          <label>
            First start date
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label>
            Duration in days
            <input
              type="number"
              min="1"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            />
          </label>
        </>
      )}
      <Button
        disabled={disabled || !name.trim()}
        onClick={() =>
          run(async () => {
            await mutate("createProjectV2Field", {
              projectId: p.id,
              name: name.trim(),
              dataType: type,
              ...(type === "SINGLE_SELECT"
                ? {
                    singleSelectOptions: opts
                      .split(",")
                      .map((o) => o.trim())
                      .filter(Boolean)
                      .map((name) => ({ name, color: "GRAY", description: "" })),
                  }
                : {}),
              ...(type === "ITERATION"
                ? {
                    iterationConfiguration: {
                      duration: days,
                      startDate: start,
                      iterations: [{ title: "Iteration 1", startDate: start, duration: days }],
                    },
                  }
                : {}),
            });
            setName("");
          }, "Field created")
        }
      >
        Create field
      </Button>
      <h3>Linked repositories</h3>
      {repos.error ? (
        <ProjectError error={repos.error} />
      ) : (
        <ul>
          {repos.data?.map((r) => (
            <li key={r.id}>
              {r.nameWithOwner}{" "}
              <ConfirmAction
                label="Unlink repository"
                subject={r.nameWithOwner}
                detail="The project will leave this repository’s Projects tab."
                disabled={disabled}
                perform={() =>
                  run(
                    () =>
                      mutate("unlinkProjectV2FromRepository", {
                        repositoryId: r.id,
                        projectId: p.id,
                      }),
                    "Repository unlinked",
                  )
                }
              />
            </li>
          ))}
        </ul>
      )}
      <label>
        Repository
        <input placeholder="owner/repo" value={repo} onChange={(e) => setRepo(e.target.value)} />
      </label>
      <Button
        disabled={disabled || !repo.trim()}
        onClick={() =>
          run(
            async () =>
              mutate("linkProjectV2ToRepository", {
                projectId: p.id,
                repositoryId: await repositoryId(repo),
              }),
            "Repository linked",
          )
        }
      >
        Link repository
      </Button>
      <h3>Project access</h3>
      <p>
        {p.public ? "Public" : "Private"} project · Each repository controls access to its issues
        and pull requests.
      </p>
      <ConfirmAction
        label={p.public ? "Make private" : "Make public"}
        subject={p.title}
        detail={
          p.public
            ? "Only people with access will see this project."
            : "Anyone can read this project, including its drafts and project fields."
        }
        disabled={disabled}
        perform={() =>
          run(
            () => mutate("updateProjectV2", { projectId: p.id, public: !p.public }),
            "Visibility updated",
          )
        }
      />
      <label>
        GitHub username
        <input value={login} onChange={(e) => setLogin(e.target.value)} />
      </label>
      <label>
        Role
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          {["READER", "WRITER", "ADMIN"].map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </label>
      <Button
        disabled={disabled || !login.trim()}
        onClick={() =>
          run(async () => {
            const { user } = await graph<{ user: { id: string } | null }>(
              "query($login:String!){user(login:$login){id}}",
              { login },
            );
            if (!user) throw new Error("User unavailable.");
            await mutate("updateProjectV2Collaborators", {
              projectId: p.id,
              collaborators: [{ userId: user.id, role }],
            });
          }, "Access updated")
        }
      >
        Save collaborator
      </Button>
      <h3>Workflows</h3>
      {rules.error ? (
        <ProjectError error={rules.error} />
      ) : (
        <ul>
          {rules.data?.map((w) => (
            <li key={w.id}>
              {w.name} · {w.enabled ? "Enabled" : "Disabled"}
            </li>
          ))}
        </ul>
      )}
      <a className="underline" href={`${p.url}/workflows`}>
        Configure workflows on GitHub
      </a>
      {p.owner.__typename === "Organization" && (
        <>
          <h3>Templates</h3>
          <Button
            variant="secondary"
            disabled={disabled}
            onClick={() =>
              run(
                () =>
                  mutate(p.template ? "unmarkProjectV2AsTemplate" : "markProjectV2AsTemplate", {
                    projectId: p.id,
                  }),
                "Template setting saved",
              )
            }
          >
            {p.template ? "Remove template designation" : "Mark as template"}
          </Button>
        </>
      )}
      <h3>Project state</h3>
      <Button
        variant="secondary"
        disabled={busy || !(p.closed ? p.viewerCanReopen : p.viewerCanClose)}
        onClick={() =>
          run(
            () => mutate("updateProjectV2", { projectId: p.id, closed: !p.closed }),
            p.closed ? "Project reopened" : "Project closed",
          )
        }
      >
        {p.closed ? "Reopen project" : "Close project"}
      </Button>
      <ConfirmAction
        label="Delete project"
        subject={p.title}
        detail="GitHub permanently deletes this project, its drafts, views and field values. Repository issues and pull requests remain in their repositories."
        disabled={disabled}
        perform={() =>
          run(async () => {
            await mutate("deleteProjectV2", { projectId: p.id });
            await navigate({ to: "/projects" });
          }, "Project deleted")
        }
      />
      <a className="underline" href={`${p.url}/settings`}>
        Advanced settings on GitHub
      </a>
    </div>
  );
}
