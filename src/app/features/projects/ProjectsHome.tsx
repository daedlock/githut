import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { FolderKanban, LockKeyhole, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/app/components/ui/dialog";
import { startReauth } from "@/app/lib/auth";
import { createProject, listProjects, owners, projectHref } from "./api";
import "./projects.css";

export function ProjectError({ error, retry }: { error: Error; retry?: () => void }) {
  return (
    <div role="alert" className="project-error">
      <p>{error.message}</p>
      {retry && (
        <Button variant="secondary" onClick={retry}>
          Retry
        </Button>
      )}
      {/scope|permission|resource not accessible/i.test(error.message) && (
        <Button variant="ghost" onClick={startReauth}>
          Authorize GitHub Projects
        </Button>
      )}
    </div>
  );
}
export function ProjectsHome({ repository }: { repository?: { owner: string; repo: string } }) {
  const [owner, setOwner] = useState("*");
  const [linkRepo, setLinkRepo] = useState("");
  const [filter, setFilter] = useState("");
  const [state, setState] = useState("open");
  const [initial, setInitial] = useState("list");
  const [template, setTemplate] = useState("");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [creator, setCreator] = useState("");
  const client = useQueryClient();
  const navigate = useNavigate();
  const accounts = useQuery({ queryKey: ["projects", "owners"], queryFn: owners });
  const login = repository?.owner || owner || accounts.data?.[0]?.login || "";
  const candidates = accounts.data ?? [];
  const creatorLogin =
    creator || candidates.find((o) => o.login === login)?.login || candidates[0]?.login;
  const logins = login === "*" ? candidates.map((o) => o.login) : [login];
  const directories = useQueries({
    queries: logins.filter(Boolean).map((name) => ({
      queryKey: ["projects", "directory", name, repository?.repo],
      queryFn: () => listProjects(name, repository?.repo),
    })),
  });
  const pending = directories.some((q) => q.isPending) || accounts.isPending;
  const templates = useQuery({
    queryKey: ["projects", "directory", creatorLogin, undefined],
    enabled: open && !!creatorLogin && !repository,
    queryFn: () => listProjects(creatorLogin!),
  });
  const create = useMutation({
    mutationFn: async () => {
      const who = candidates.find((o) => o.login === creatorLogin);
      if (!who || !title.trim()) throw new Error("Choose an owner and name the project.");
      return createProject(
        who,
        title.trim(),
        repository ? `${repository.owner}/${repository.repo}` : linkRepo.trim() || undefined,
        template || undefined,
      );
    },
    onSuccess: async (p) => {
      await client.invalidateQueries({ queryKey: ["projects", "directory"] });
      setOpen(false);
      void navigate({ to: projectHref(p), search: { view: initial } });
    },
  });
  const shown =
    directories
      .flatMap((q) => q.data ?? [])
      .filter(
        (p) =>
          (state === "templates" ? p.template : p.closed === (state === "closed")) &&
          p.title.toLowerCase().includes(filter.toLowerCase()),
      ) ?? [];
  return (
    <section className="projects-page">
      <header className="project-header">
        <div>
          <p className="project-eyebrow">
            {repository ? `${repository.owner}/${repository.repo}` : "Workspace"}
          </p>
          <h1>Projects</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus />
              New project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>New project</DialogTitle>
            <form
              className="project-form"
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate();
              }}
            >
              <label>
                Owner
                <select
                  value={creatorLogin ?? ""}
                  onChange={(e) => {
                    setCreator(e.target.value);
                    setTemplate("");
                  }}
                >
                  {candidates.map((o) => (
                    <option key={o.id}>{o.login}</option>
                  ))}
                </select>
              </label>
              <label>
                Project name
                <input
                  required
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label>
                Start in
                <select value={initial} onChange={(e) => setInitial(e.target.value)}>
                  <option value="list">List</option>
                  <option value="board">Board</option>
                  <option value="roadmap">Roadmap</option>
                </select>
              </label>
              {!repository && templates.data?.some((p) => p.template) && (
                <label>
                  Template
                  <select value={template} onChange={(e) => setTemplate(e.target.value)}>
                    <option value="">Blank project</option>
                    {templates.data
                      .filter((p) => p.template)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              {!repository && !template && (
                <label>
                  Link repository (optional)
                  <input
                    placeholder="owner/repo"
                    value={linkRepo}
                    onChange={(e) => setLinkRepo(e.target.value)}
                  />
                </label>
              )}
              {repository && (
                <p>
                  Linked repository · {repository.owner}/{repository.repo}
                </p>
              )}
              {create.error && <ProjectError error={create.error} />}
              <Button disabled={!title.trim() || !creatorLogin || create.isPending}>
                Create project
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>
      <div className="project-tools">
        {!repository && (
          <select
            aria-label="Project owner"
            value={login}
            onChange={(e) => setOwner(e.target.value)}
          >
            <option value="*">All owners</option>
            {candidates.map((o) => (
              <option key={o.id}>{o.login}</option>
            ))}
          </select>
        )}
        <input
          type="search"
          aria-label="Find projects"
          placeholder="Find a project…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <select aria-label="Project state" value={state} onChange={(e) => setState(e.target.value)}>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="templates">Templates</option>
        </select>
      </div>
      {accounts.error && <ProjectError error={accounts.error} retry={() => accounts.refetch()} />}
      {directories.map(
        (q, i) =>
          q.error && <ProjectError key={logins[i]} error={q.error} retry={() => q.refetch()} />,
      )}
      {pending && shown.length === 0 ? (
        <p role="status">Loading projects…</p>
      ) : shown.length === 0 ? (
        <p className="project-empty">
          {filter
            ? "No matching projects."
            : repository
              ? "No linked projects in this state."
              : "No projects in this state."}
        </p>
      ) : (
        <ul className="project-directory">
          {shown.map((p) => (
            <li key={p.id}>
              <Link to={projectHref(p)}>
                <FolderKanban />
                <span>
                  <strong>{p.title}</strong>
                  <small>
                    @{p.owner.login} · #{p.number}
                    {p.template ? " · Template" : ""}
                    {p.shortDescription ? ` · ${p.shortDescription}` : ""}
                  </small>
                </span>
                {!p.public && <LockKeyhole size={14} aria-label="Private project" />}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
