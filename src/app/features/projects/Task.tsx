import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/app/components/ui/sheet";
import { issueKeys, useRepoIssueComments } from "@/app/features/issues/hooks";
import { pullsKeys } from "@/app/features/pulls/hooks";
import { getGitHubClient } from "@/app/lib/github/client";
import {
  displayValue,
  type Field,
  graph,
  type Item,
  issueRef,
  itemFieldValue,
  mutate,
  type Project,
  repositoryId,
  setField,
  storedValue,
} from "./api";
import { Memberships } from "./Memberships";
import { Relationships } from "./Relationships";

export type Run = (work: () => Promise<unknown>, success: string) => Promise<boolean>;
export const editable = (f: Field) =>
  ["NUMBER", "DATE", "SINGLE_SELECT", "ITERATION", "TEXT"].includes(f.dataType);
export function FieldInput({
  item,
  field,
  disabled,
  save,
}: {
  item: Item;
  field: Field;
  disabled: boolean;
  save: (v: string) => void;
}) {
  const value = itemFieldValue(item, field);
  const options =
    field.options ??
    (field.configuration
      ? [...field.configuration.iterations, ...field.configuration.completedIterations].map(
          (i) => ({ id: i.id, name: i.title }),
        )
      : undefined);
  const stored = value?.optionId ?? value?.iterationId ?? displayValue(value);
  if (options)
    return (
      <select
        aria-label={field.name}
        value={stored}
        disabled={disabled}
        onChange={(e) => save(e.target.value)}
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    );
  return (
    <input
      key={stored}
      aria-label={field.name}
      disabled={disabled}
      defaultValue={stored}
      type={field.dataType === "DATE" ? "date" : field.dataType === "NUMBER" ? "number" : "text"}
      step="any"
      onBlur={(e) => {
        if (e.target.value !== stored && e.target.validity.valid) save(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}
export function Task({
  item,
  project,
  fields,
  close,
  run,
  busy,
  feedback,
}: {
  item: Item;
  project: Project;
  fields: Field[];
  close: () => void;
  run: Run;
  busy: boolean;
  feedback: string;
}) {
  const content = item.content;
  const [title, setTitle] = useState(content?.title ?? "");
  const [body, setBody] = useState(content?.body ?? "");
  const [version, setVersion] = useState(content?.updatedAt);
  const [entry, setEntry] = useState("");
  const [action, setAction] = useState("comment");
  const [repoName, setRepoName] = useState("");
  const [owner = "", repo = ""] = content?.repository?.nameWithOwner.split("/") ?? [];
  const number = content?.number ?? 0;
  const draft = content?.__typename === "DraftIssue";
  const issue = content?.__typename === "Issue";
  const repoWrite = !!content?.viewerCanUpdate;
  const disabled = busy || !project.viewerCanUpdate || !content?.id;
  const qc = useQueryClient();
  const comments = useRepoIssueComments(owner, repo, number || undefined);
  async function refreshRepo() {
    await Promise.all(
      [
        issueKeys.detail(owner, repo, number),
        issueKeys.all(owner, repo),
        issueKeys.comments(owner, repo, number),
        pullsKeys.detail(owner, repo, number),
        pullsKeys.comments(owner, repo, number),
      ].map((queryKey) => qc.invalidateQueries({ queryKey })),
    );
  }
  const rest = { owner, repo, issue_number: number };
  async function edit() {
    if (!content) return;
    const updated = await graph<{ node: { updatedAt: string } | null }>(
      `query($id:ID!){node(id:$id){... on ${content.__typename}{updatedAt}}}`,
      { id: content.id },
    );
    if (updated.node?.updatedAt !== version)
      throw new Error(
        "This task changed on GitHub. Reopen it to review the latest text before saving.",
      );
    const key = draft ? "draftIssue" : issue ? "issue" : "pullRequest";
    const result = await mutate<Record<string, { updatedAt: string }>>(
      draft ? "updateProjectV2DraftIssue" : issue ? "updateIssue" : "updatePullRequest",
      {
        [draft ? "draftIssueId" : issue ? "id" : "pullRequestId"]: content.id,
        title: title.trim(),
        body,
      },
      `${key}{updatedAt}`,
    );
    setVersion(result[key]?.updatedAt);
    if (!draft) await refreshRepo();
  }
  async function perform() {
    const client = getGitHubClient();
    if (action === "comment")
      await client.request("POST /repos/{owner}/{repo}/issues/{issue_number}/comments", {
        ...rest,
        body: entry.trim(),
      });
    else if (action === "subissue" || action === "dependency") {
      const target = await issueRef(entry);
      if (target.pull_request) throw new Error("Choose an issue for this relationship.");
      if (action === "subissue")
        await mutate("addSubIssue", { issueId: content?.id, subIssueId: target.node_id });
      else
        await client.request(
          "POST /repos/{owner}/{repo}/issues/{issue_number}/dependencies/blocked_by",
          { ...rest, issue_id: target.id },
        );
    } else if (action === "linkpr") {
      const pr = await issueRef(entry);
      if (!pr.pull_request) throw new Error("Choose a pull request.");
      const repoPath = new URL(pr.repository_url).pathname.split("/").slice(-2);
      const params = { owner: repoPath[0]!, repo: repoPath[1]!, pull_number: pr.number };
      const { data: current } = await client.request(
        "GET /repos/{owner}/{repo}/pulls/{pull_number}",
        params,
      );
      const reference = `Closes ${owner}/${repo}#${number}`;
      if (!current.body?.includes(reference))
        await client.request("PATCH /repos/{owner}/{repo}/pulls/{pull_number}", {
          ...params,
          body: [current.body, reference].filter(Boolean).join("\n\n"),
        });
    } else if (action === "assignee")
      await client.request("POST /repos/{owner}/{repo}/issues/{issue_number}/assignees", {
        ...rest,
        assignees: [entry.trim()],
      });
    else if (action === "label")
      await client.request("POST /repos/{owner}/{repo}/issues/{issue_number}/labels", {
        ...rest,
        labels: [entry.trim()],
      });
    else if (action === "milestone")
      await client.request("PATCH /repos/{owner}/{repo}/issues/{issue_number}", {
        ...rest,
        milestone: Number(entry),
      });
    await refreshRepo();
    setEntry("");
  }
  return (
    <Sheet
      open
      onOpenChange={(o) => {
        if (!o) close();
      }}
    >
      <SheetContent
        side="right"
        className="w-full max-w-full overflow-auto p-5 sm:max-w-lg motion-reduce:animate-none"
      >
        <SheetTitle className="pr-10">{content?.title ?? "Restricted item"}</SheetTitle>
        <SheetDescription>
          {content?.repository
            ? `${content.repository.nameWithOwner}#${number}`
            : draft
              ? "Draft issue"
              : "Repository access required"}
        </SheetDescription>
        <div className="project-form mt-6">
          <h3>{project.title} · Only this project</h3>
          {!project.viewerCanUpdate && <p>Read-only project access</p>}
          {fields.filter(editable).map((field) => (
            <div key={field.id} className="grid gap-1">
              {field.name}
              <FieldInput
                item={item}
                field={field}
                disabled={disabled}
                save={(v) =>
                  void run(
                    () =>
                      setField(
                        project.id,
                        item.id,
                        field,
                        v,
                        storedValue(itemFieldValue(item, field)),
                      ),
                    `${field.name} saved`,
                  )
                }
              />
            </div>
          ))}
          {content?.id && (
            <>
              <h3>{draft ? "Draft details" : "Repository item · Shared across projects"}</h3>
              {!draft && (
                <Link
                  to={issue ? "/$owner/$repo/issues/$number" : "/$owner/$repo/pull/$number"}
                  params={{ owner, repo, number }}
                  className="underline"
                >
                  Open {issue ? "issue" : "pull request"} in Githut
                </Link>
              )}
              {!draft && (
                <p>
                  {[
                    content.assignees?.nodes.map((u) => `@${u.login}`).join(", "),
                    content.labels?.nodes.map((l) => l.name).join(", "),
                    content.milestone?.title,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
              {!draft && <Memberships owner={owner} repo={repo} number={number} />}
              {issue && <Relationships id={content.id} owner={owner} repo={repo} number={number} />}
              <label>
                Title
                <input
                  value={title}
                  disabled={draft ? disabled : !repoWrite}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label>
                Description
                <textarea
                  value={body}
                  disabled={draft ? disabled : !repoWrite}
                  onChange={(e) => setBody(e.target.value)}
                />
              </label>
              <Button
                disabled={busy || !title.trim() || (draft ? disabled : !repoWrite)}
                onClick={() => run(edit, "Task saved")}
              >
                Save details
              </Button>
              {draft ? (
                <>
                  <label>
                    Destination repository
                    <input
                      placeholder="owner/repo"
                      value={repoName}
                      onChange={(e) => setRepoName(e.target.value)}
                    />
                  </label>
                  <Button
                    variant="secondary"
                    disabled={disabled || !repoName}
                    onClick={() =>
                      run(
                        async () =>
                          mutate("convertProjectV2DraftIssueItemToIssue", {
                            itemId: item.id,
                            repositoryId: await repositoryId(repoName),
                          }),
                        "Draft converted to issue",
                      )
                    }
                  >
                    Convert to issue
                  </Button>
                </>
              ) : (
                <>
                  <h3>Activity</h3>
                  {comments.data?.map((c) => (
                    <article key={c.id}>
                      <strong>{c.user?.login}</strong>
                      <p className="whitespace-pre-wrap">{c.body}</p>
                    </article>
                  ))}
                  <label>
                    Repository action
                    <select
                      value={action}
                      onChange={(e) => {
                        setAction(e.target.value);
                        setEntry("");
                      }}
                    >
                      <option value="comment">Add comment</option>
                      {repoWrite && (
                        <>
                          <option value="assignee">Add assignee</option>
                          <option value="label">Add label</option>
                          <option value="milestone">Set milestone number</option>
                          {issue && (
                            <>
                              <option value="subissue">Add sub-issue</option>
                              <option value="dependency">Mark as blocked by issue</option>
                              <option value="linkpr">Add closing reference to pull request</option>
                            </>
                          )}
                        </>
                      )}
                    </select>
                  </label>
                  <label>
                    {
                      {
                        comment: "Comment",
                        linkpr: "Pull request to edit (owner/repo#123)",
                        subissue: "Sub-issue (owner/repo#123)",
                        dependency: "Blocking issue (owner/repo#123)",
                        assignee: "GitHub login",
                        label: "Label name",
                        milestone: "Milestone number",
                      }[action]
                    }
                    <input value={entry} onChange={(e) => setEntry(e.target.value)} />
                  </label>
                  {action === "linkpr" && (
                    <p>
                      This appends “Closes {owner}/{repo}#{number}” to the pull request description.
                    </p>
                  )}
                  <Button
                    variant="secondary"
                    disabled={busy || !entry.trim()}
                    onClick={() => run(perform, "Repository updated")}
                  >
                    Apply
                  </Button>
                  {issue && repoWrite && (
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          await getGitHubClient().request(
                            "PATCH /repos/{owner}/{repo}/issues/{issue_number}",
                            { ...rest, state: content.state === "OPEN" ? "closed" : "open" },
                          );
                          await refreshRepo();
                        }, "Issue state updated")
                      }
                    >
                      {content.state === "OPEN" ? "Close" : "Reopen"} issue
                    </Button>
                  )}
                </>
              )}
            </>
          )}
          <Button
            variant="ghost"
            disabled={disabled}
            onClick={() =>
              run(
                () =>
                  mutate(item.isArchived ? "unarchiveProjectV2Item" : "archiveProjectV2Item", {
                    projectId: project.id,
                    itemId: item.id,
                  }),
                item.isArchived ? "Task restored" : "Task archived",
              )
            }
          >
            {item.isArchived ? "Restore item" : "Archive item"}
          </Button>
          <p role="status">{feedback}</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
