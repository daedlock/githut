import { getGitHubClient } from "@/app/lib/github/client";

export const graph = <T>(query: string, variables: Record<string, unknown> = {}) =>
  getGitHubClient().graphql<T>(query, variables);

interface Page<T> {
  nodes: (T | null)[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
}
const pageInfo = "pageInfo { hasNextPage endCursor }";
export async function pages<T>(read: (after: string | null) => Promise<Page<T>>) {
  const result: T[] = [];
  let after: string | null = null;
  do {
    const page = await read(after);
    result.push(...page.nodes.filter((value): value is T => value !== null));
    if (!page.pageInfo.hasNextPage) break;
    if (!page.pageInfo.endCursor || page.pageInfo.endCursor === after)
      throw new Error("GitHub returned an incomplete page.");
    after = page.pageInfo.endCursor;
  } while (after);
  return result;
}
export interface Owner {
  id: string;
  login: string;
  __typename: "Organization" | "User";
}
export interface Project {
  id: string;
  title: string;
  number: number;
  url: string;
  owner: Owner;
  shortDescription: string | null;
  closed: boolean;
  template: boolean;
  public: boolean;
  viewerCanClose: boolean;
  viewerCanReopen: boolean;
  viewerCanUpdate: boolean;
  readme: string | null;
}
const summary =
  "id title number url shortDescription closed template public viewerCanUpdate viewerCanClose viewerCanReopen readme owner { __typename ... on Organization { id login } ... on User { id login } }";
export const projectHref = (p: Project) =>
  `/projects/${p.owner.__typename === "Organization" ? "orgs" : "users"}/${p.owner.login}/${p.number}`;
export async function owners() {
  const { viewer } = await graph<{ viewer: Owner }>("query {viewer {id login __typename}}");
  const orgs = await pages<Owner>(
    async (after) =>
      (
        await graph<{ viewer: { organizations: Page<Owner> } }>(
          `query($after:String){viewer {organizations(first:100,after:$after){nodes{id login __typename} ${pageInfo}}}}`,
          { after },
        )
      ).viewer.organizations,
  );
  return [viewer, ...orgs];
}
export async function listProjects(owner: string, repo?: string) {
  const query = repo ? "repository(owner:$owner,name:$repo)" : "repositoryOwner(login:$owner)";
  return pages<Project>(async (after) => {
    const fields = `projectsV2(first:50,after:$after){nodes{${summary}} ${pageInfo}}`;
    const { root } = await graph<{ root: null | { projectsV2: Page<Project> } }>(
      `query($owner:String!,$after:String${repo ? ",$repo:String!" : ""}){root:${query}{${repo ? fields : `... on ProjectV2Owner {${fields}}`}}}`,
      { owner, ...(repo ? { repo } : {}), after },
    );
    if (!root) throw new Error("This owner or repository is unavailable.");
    return root.projectsV2;
  });
}
export interface Field {
  id: string;
  name: string;
  dataType: string;
  databaseId?: number;
  options?: { id: string; name: string; color: string }[];
  configuration?: { iterations: Iteration[]; completedIterations: Iteration[] };
}
interface Iteration {
  id: string;
  title: string;
  startDate: string;
  duration: number;
}
export interface Content {
  __typename: "DraftIssue" | "Issue" | "PullRequest";
  id: string;
  title: string;
  body: string;
  number?: number;
  repository?: { nameWithOwner: string };
  assignees?: { nodes: { login: string }[] };
  labels?: { nodes: { name: string }[] };
  milestone?: { title: string; dueOn: string | null } | null;
  viewerCanUpdate?: boolean;
  state?: string;
  closedAt?: string | null;
  updatedAt: string;
}
export interface Value {
  field?: { id: string };
  text?: string;
  date?: string;
  number?: number;
  name?: string;
  title?: string;
  optionId?: string;
  iterationId?: string;
}
export interface Item {
  id: string;
  createdAt: string;
  isArchived: boolean;
  type: string;
  content: Content | null;
  fieldValues: Page<Value>;
}
export interface View {
  id: string;
  name: string;
  number: number;
  layout: "TABLE_LAYOUT" | "BOARD_LAYOUT" | "ROADMAP_LAYOUT";
  filter: string | null;
  fields: { nodes: { id?: string }[] };
  verticalGroupByFields: { nodes: { id?: string }[] };
  groupByFields: { nodes: { id?: string }[] };
}
export interface Update {
  id: string;
  body: string;
  createdAt: string;
  status: string;
  startDate: string | null;
  targetDate: string | null;
}
export interface Workspace {
  project: Project;
  fields: Field[];
  items: Item[];
  views: View[];
}
export const itemFieldValue = (item: Item, field: Field) =>
  item.fieldValues.nodes.find((v) => v?.field?.id === field.id);
export const displayValue = (v: Value | undefined | null) =>
  String(v?.name ?? v?.title ?? v?.text ?? v?.date ?? v?.number ?? "");
const fieldSelection = `... on ProjectV2FieldCommon {id databaseId name dataType} ... on ProjectV2SingleSelectField {options{id name color}} ... on ProjectV2IterationField {configuration{iterations{id title duration startDate} completedIterations{id title duration startDate}}}`;
const valueSelection = [
  "Text:text",
  "Number:number",
  "Date:date",
  "SingleSelect:name optionId",
  "Iteration:title iterationId",
]
  .map((spec) => {
    const [kind, fields] = spec.split(":");
    return `... on ProjectV2ItemField${kind}Value { ${fields} field{... on ProjectV2FieldCommon{id}} }`;
  })
  .join(" ");
const contentSelection = ["Issue", "PullRequest", "DraftIssue"]
  .map(
    (type) =>
      `... on ${type}{id title body updatedAt assignees(first:20){nodes{login}} ${type === "DraftIssue" ? "" : "number state closedAt viewerCanUpdate labels(first:30){nodes{name}} milestone{title dueOn} repository{nameWithOwner}"}}`,
  )
  .join(" ");
function connection<T>(id: string, key: string, selection: string, type = "ProjectV2") {
  return pages<T>(async (after) => {
    const { node } = await graph<{ node: Record<string, Page<T>> | null }>(
      `query($id:ID!,$after:String){node(id:$id){... on ${type}{${key}(first:50,after:$after){nodes{${selection}} ${pageInfo}}}}}`,
      { id, after },
    );
    if (!node?.[key]) throw new Error("Project data is unavailable.");
    return node[key];
  });
}
export async function workspace(kind: string, login: string, number: number): Promise<Workspace> {
  const root = kind === "orgs" ? "organization" : "user";
  const { owner } = await graph<{ owner: { projectV2: Project | null } | null }>(
    `query($login:String!,$number:Int!){owner:${root}(login:$login){projectV2(number:$number){${summary}}}}`,
    { login, number },
  );
  const project = owner?.projectV2;
  if (!project) throw new Error("This project is unavailable to your account.");
  const [fields, items, views] = await Promise.all([
    connection<Field>(project.id, "fields", fieldSelection),
    connection<Item>(
      project.id,
      "items",
      `id createdAt isArchived type content{__typename ${contentSelection}} fieldValues(first:100){nodes{${valueSelection}} ${pageInfo}}`,
    ),
    connection<View>(
      project.id,
      "views",
      `id name number layout filter fields(first:100){nodes{... on ProjectV2FieldCommon{id}}} verticalGroupByFields(first:1){nodes{... on ProjectV2FieldCommon{id}}} groupByFields(first:1){nodes{... on ProjectV2FieldCommon{id}}}`,
    ),
  ]);
  for (const item of items)
    if (item.fieldValues.pageInfo.hasNextPage)
      item.fieldValues.nodes = await connection<Value>(
        item.id,
        "fieldValues",
        valueSelection,
        "ProjectV2Item",
      );
  return { project, fields, items, views };
}
export function linkedRepositories(id: string) {
  return connection<{ id: string; nameWithOwner: string }>(id, "repositories", "id nameWithOwner");
}
export function workflows(id: string) {
  return connection<{ id: string; name: string; enabled: boolean }>(
    id,
    "workflows",
    "id name enabled",
  );
}
export function updates(id: string) {
  return connection<Update>(id, "statusUpdates", "id body status startDate targetDate createdAt");
}
export async function mutate<T = unknown>(
  name: string,
  input: Record<string, unknown>,
  selection = "clientMutationId",
) {
  const type = `${name.charAt(0).toUpperCase() + name.slice(1)}Input`;
  const data = await graph<{ result: T }>(
    `mutation($input:${type}!){result:${name}(input:$input){${selection}}}`,
    { input },
  );
  return data.result;
}
export async function repositoryId(fullName: string) {
  const [owner, repo, extra] = fullName.trim().split("/");
  if (!owner || !repo || extra) throw new Error("Enter a repository as owner/name.");
  const { data } = await getGitHubClient().request("GET /repos/{owner}/{repo}", { owner, repo });
  return data.node_id;
}
export async function createProject(owner: Owner, title: string, repo?: string, template?: string) {
  if (template) {
    const { projectV2 } = await mutate<{ projectV2: Project }>(
      "copyProjectV2",
      { ownerId: owner.id, projectId: template, title },
      `projectV2{${summary}}`,
    );
    return projectV2;
  }
  const repositoryIdValue = repo ? await repositoryId(repo) : undefined;
  const { projectV2 } = await mutate<{ projectV2: Project }>(
    "createProjectV2",
    { ownerId: owner.id, title, repositoryId: repositoryIdValue },
    `projectV2{${summary}}`,
  );
  return projectV2;
}
export const storedValue = (v: Value | null | undefined) =>
  v?.optionId ?? v?.iterationId ?? displayValue(v);
export class FieldConflict extends Error {
  constructor(
    public field: Field,
    public itemId: string,
    public requested: string,
    public current: Value | null,
  ) {
    super(`${field.name} changed on GitHub.`);
  }
}
export async function setField(
  projectId: string,
  itemId: string,
  field: Field,
  value: string,
  expected?: string,
) {
  if (expected !== undefined) {
    const { node } = await graph<{ node: { live: Value | null } | null }>(
      `query($id:ID!,$name:String!){node(id:$id){... on ProjectV2Item{live:fieldValueByName(name:$name){${valueSelection}}}}}`,
      { id: itemId, name: field.name },
    );
    if (!node) throw new Error("This item is no longer available.");
    const live = storedValue(node.live);
    if (live === value) return;
    if (live !== expected) throw new FieldConflict(field, itemId, value, node.live);
  }
  const base = { projectId, itemId, fieldId: field.id };
  if (!value) return mutate("clearProjectV2ItemFieldValue", base);
  const target: Record<string, string> = {
    DATE: "date",
    TEXT: "text",
    NUMBER: "number",
    SINGLE_SELECT: "singleSelectOptionId",
    ITERATION: "iterationId",
  };
  const key = target[field.dataType];
  if (!key) throw new Error("This field is managed on the repository item.");
  if (key === "number" && !Number.isFinite(Number(value))) throw new Error("Enter a number.");
  return mutate("updateProjectV2ItemFieldValue", {
    ...base,
    value: { [key]: key === "number" ? Number(value) : value },
  });
}
export async function issueRef(input: string) {
  const match = input
    .trim()
    .match(/^(?:https:\/\/github\.com\/)?([\w.-]+)\/([\w.-]+)(?:#|\/(?:issues|pull)\/)(\d+)\/?$/);
  if (!match) throw new Error("Enter owner/repo#123 or a GitHub issue or pull request URL.");
  const { data } = await getGitHubClient().request(
    "GET /repos/{owner}/{repo}/issues/{issue_number}",
    { owner: match[1]!, repo: match[2]!, issue_number: Number(match[3]) },
  );
  return data;
}
export function projectPath(p: Project) {
  return `/${p.owner.__typename === "Organization" ? "orgs" : "users"}/${encodeURIComponent(p.owner.login)}/projectsV2/${p.number}`;
}
export async function viewMembers(project: Project, view: number) {
  const ids: string[] = [];
  let url: string | undefined = `${projectPath(project)}/views/${view}/items?per_page=100`;
  while (url) {
    const page: { data: unknown; headers: { link?: string } } = await getGitHubClient().request(
      `GET ${url}`,
    );
    ids.push(...(page.data as { node_id: string }[]).map((i) => i.node_id));
    url = page.headers.link?.match(/<([^>]+)>; rel="next"/)?.[1];
  }
  return ids;
}

interface Membership {
  id: string;
  isArchived: boolean;
  project: Project;
  status: { name?: string } | null;
}
export function memberships(owner: string, repo: string, number: number) {
  return pages<Membership>(async (after) => {
    const { repository } = await graph<{
      repository: { issueOrPullRequest: { projectItems: Page<Membership> } | null } | null;
    }>(
      `query($owner:String!,$repo:String!,$number:Int!,$after:String){repository(owner:$owner,name:$repo){issueOrPullRequest(number:$number){... on Issue{${membershipSelection}} ... on PullRequest{${membershipSelection}}}}}`,
      { owner, repo, number, after },
    );
    if (!repository?.issueOrPullRequest) throw new Error("Repository item unavailable.");
    return repository.issueOrPullRequest.projectItems;
  });
}
const membershipSelection = `projectItems(first:50,after:$after){nodes{id isArchived project{${summary}} status:fieldValueByName(name:"Status"){... on ProjectV2ItemFieldSingleSelectValue{name}}} ${pageInfo}}`;
