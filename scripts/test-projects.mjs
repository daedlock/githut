import assert from "node:assert/strict";
import { chromium } from "playwright";

// Start a local Githut server and pass UI_BASE_URL to exercise the signed-in routes.
const base = process.env.UI_BASE_URL || "http://127.0.0.1:5173";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN, headless: true });
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() =>
      localStorage.setItem(
        "githut.auth",
        JSON.stringify({ state: { token: "fixture" }, version: 0 }),
      ),
    );
    const actor = {
      id: 1,
      login: "octo",
      avatar_url: "",
      html_url: "https://github.com/octo",
      type: "User",
    };
    const owner = { id: "user", login: "octo", __typename: "User" };
    const project = {
      id: "proj",
      owner,
      number: 1,
      title: "Release planning",
      public: false,
      closed: false,
      template: false,
      viewerCanUpdate: true,
      url: "https://github.com/users/octo/projects/1",
    };
    const fields = [
      {
        id: "status",
        name: "Status",
        dataType: "SINGLE_SELECT",
        options: [
          { id: "todo", name: "Todo" },
          { id: "done", name: "Done" },
        ],
      },
      { id: "date", name: "Target date", dataType: "DATE" },
    ];
    const conn = (nodes) => ({ nodes, pageInfo: { hasNextPage: false, endCursor: null } });
    const items = [];
    const statusUpdates = [];
    const children = [];
    let blockedBy = 0;
    let linked = false;
    let creates = 0,
      adds = 0,
      projectCreates = 0;
    const addItem = (title, type) => {
      const id = `item${items.length}`;
      items.push({
        id,
        isArchived: false,
        type,
        content: {
          __typename: type,
          title,
          id: `content${id}`,
          updatedAt: "2026-01-01",
          body: "",
          ...(type === "Issue"
            ? {
                state: "OPEN",
                number: 7,
                repository: { nameWithOwner: "octo/repo" },
                viewerCanUpdate: true,
              }
            : {}),
        },
        fieldValues: conn([]),
      });
      return id;
    };
    await page.route("https://api.github.com/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      const json = (data, status = 200) => route.fulfill({ status, json: data });
      if (path === "/graphql") {
        const { query: q, variables: v } = route.request().postDataJSON();
        let data;
        if (q.includes("mutation")) {
          const i = v.input;
          if (q.includes("createProjectV2(")) {
            projectCreates++;
            data = { result: { projectV2: { ...project, title: i.title } } };
          } else if (q.includes("updateIssue(")) {
            const c = items.find((t) => t.content.id === i.id).content;
            Object.assign(c, { title: i.title, body: i.body, updatedAt: "2026-11-19" });
            data = { result: { issue: { updatedAt: c.updatedAt } } };
          } else if (q.includes("addSubIssue(")) {
            children.push({
              id: i.subIssueId,
              title: "Subtask",
              number: 8,
              repository: { nameWithOwner: "octo/repo" },
            });
            data = { result: {} };
          } else if (q.includes("createProjectV2StatusUpdate(")) {
            statusUpdates.push({ ...i, id: "update", createdAt: i.startDate });
            data = { result: {} };
          } else if (q.includes("addProjectV2DraftIssue"))
            data = { result: { projectItem: { id: addItem(i.title, "DraftIssue") } } };
          else if (q.includes("updateProjectV2ItemFieldValue")) {
            const item = items.find((t) => t.id === i.itemId);
            const vals = item.fieldValues.nodes.filter((n) => n.field.id !== i.fieldId);
            vals.push(
              i.fieldId === "status"
                ? {
                    field: { id: "status" },
                    optionId: i.value.singleSelectOptionId,
                    name: fields[0].options.find((o) => o.id === i.value.singleSelectOptionId).name,
                  }
                : { field: { id: "date" }, date: i.value.date },
            );
            item.fieldValues = conn(vals);
            data = { result: {} };
          } else if (q.includes("addProjectV2ItemById")) {
            adds++;
            if (adds === 1) return json({ errors: [{ message: "Simulated membership failure" }] });
            data = { result: { item: { id: addItem("Ship release", "Issue") } } };
          } else if (q.includes("convertProjectV2DraftIssueItemToIssue")) {
            const c = items.find((x) => x.id === i.itemId).content;
            Object.assign(c, {
              __typename: "Issue",
              repository: { nameWithOwner: "octo/repo" },
              number: 3,
              state: "OPEN",
              viewerCanUpdate: true,
            });
            data = { result: {} };
          } else return json({ errors: [{ message: "Unexpected mutation" }] });
        } else if (q.includes("live:fieldValueByName")) {
          const field = fields.find((f) => f.name === v.name);
          data = {
            node: {
              live:
                items
                  .find((i) => i.id === v.id)
                  ?.fieldValues.nodes.find((f) => f.field.id === field.id) ?? null,
            },
          };
        } else if (q.includes("organizations(first"))
          data = { viewer: { organizations: conn([]) } };
        else if (q.includes("viewer {id login")) data = { viewer: owner };
        else if (q.includes("root:")) data = { root: { projectsV2: conn([project]) } };
        else if (q.includes("owner:user("))
          data = {
            owner: {
              projectV2: {
                ...project,
                id: v.number === 1 ? "proj" : "other",
                number: v.number,
                viewerCanUpdate: v.number !== 3,
              },
            },
          };
        else if (q.includes("... on Issue{updatedAt}"))
          data = {
            node: { updatedAt: items.find((i) => i.content.id === v.id)?.content.updatedAt },
          };
        else if (q.includes("... on Issue{subIssues("))
          data = { node: { subIssues: conn(children) } };
        else if (q.includes("... on Issue{closedByPullRequestsReferences("))
          data = {
            node: {
              closedByPullRequestsReferences: conn(
                linked
                  ? [
                      {
                        id: "pr",
                        number: 9,
                        title: "Release PR",
                        repository: { nameWithOwner: "octo/repo" },
                      },
                    ]
                  : [],
              ),
            },
          };
        else if (q.includes("statusUpdates(first:"))
          data = { node: { statusUpdates: conn(statusUpdates) } };
        else if (q.includes("... on ProjectV2{fields(")) data = { node: { fields: conn(fields) } };
        else if (q.includes("... on ProjectV2{items("))
          data = {
            node: {
              items: conn(
                v.id === "proj"
                  ? items
                  : [
                      ...items.map((i) => ({ ...i, fieldValues: conn([]) })),
                      {
                        id: "locked",
                        type: "REDACTED",
                        isArchived: false,
                        content: null,
                        fieldValues: conn([]),
                      },
                    ],
              ),
            },
          };
        else if (q.includes("... on ProjectV2{views(")) data = { node: { views: conn([]) } };
        else data = {};
        return json({ data });
      }
      if (path.endsWith("/dependencies/blocked_by")) {
        if (route.request().method() === "POST") blockedBy++;
        return json(
          blockedBy
            ? [
                {
                  node_id: "block",
                  title: "Blocking issue",
                  number: 8,
                  repository_url: "https://api.github.com/repos/octo/repo",
                },
              ]
            : [],
        );
      }
      if (path === "/repos/octo/repo/issues/8" || path === "/repos/octo/repo/issues/9")
        return json({
          id: 8,
          node_id: "related",
          number: path.endsWith("9") ? 9 : 8,
          repository_url: "https://api.github.com/repos/octo/repo",
          ...(path.endsWith("9") ? { pull_request: {} } : {}),
        });
      if (path === "/repos/octo/repo/pulls/9") {
        if (route.request().method() === "PATCH")
          linked = route.request().postDataJSON().body.includes("Closes octo/repo#3");
        return json({ body: "Release" });
      }
      if (path === "/repos/octo/repo/issues/3" && route.request().method() === "PATCH") {
        items[0].content.state = "CLOSED";
        return json({});
      }
      if (path === "/user") return json(actor);
      if (path === "/repos/octo/repo/issues" && route.request().method() === "POST") {
        creates++;
        return json({ node_id: "created", number: 7 });
      }
      if (path === "/repos/octo/repo")
        return json({
          node_id: "repository",
          name: "repo",
          full_name: "octo/repo",
          owner: actor,
          default_branch: "main",
        });
      return json(path.startsWith("/search/") ? { items: [], total_count: 0 } : []);
    });
    await page.goto(`${base}/projects`);
    await page.getByRole("button", { name: "New project" }).click();
    await page.getByRole("dialog").getByLabel("Project name").fill("Release planning");
    await page.getByRole("button", { name: "Create project" }).click();
    const ui = page.locator(".project-workspace");
    await ui.getByRole("button", { name: "Board", exact: true }).click();
    assert.equal(projectCreates, 1);
    await ui
      .locator(".project-column")
      .filter({ has: page.getByRole("heading", { name: /Todo/ }) })
      .getByRole("button", { name: "Add task" })
      .click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Title", { exact: true }).fill("Draft plan");
    await dialog.getByRole("button", { name: "Add task", exact: true }).click();
    await ui.getByRole("button", { name: /Draft plan/ }).waitFor();
    await ui.getByRole("button", { name: /Draft plan/ }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Destination repository").fill("octo/repo");
    await dialog.getByRole("button", { name: "Convert to issue" }).click();
    await dialog.getByRole("link", { name: "Open issue in Githut" }).waitFor();
    await dialog.getByLabel("Title", { exact: true }).fill("Release task");
    await dialog.getByRole("button", { name: "Save details" }).click();
    await dialog.getByText("Task saved", { exact: true }).waitFor();
    for (const [action, ref] of [
      ["subissue", "octo/repo#8"],
      ["dependency", "octo/repo#8"],
      ["linkpr", "octo/repo#9"],
    ]) {
      await dialog.getByLabel("Repository action").selectOption(action);
      await dialog.locator("input").last().fill(ref);
      await dialog.getByRole("button", { name: "Apply", exact: true }).click();
      await dialog.getByText("Repository updated", { exact: true }).waitFor();
    }
    assert.equal(children.length, 1);
    assert.equal(blockedBy, 1);
    assert.equal(linked, true);
    await dialog.getByRole("button", { name: "Close issue" }).click();
    await dialog.getByRole("button", { name: "Reopen issue" }).waitFor();
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await ui.getByRole("button", { name: "List", exact: true }).click();
    // Another writer clears Status after this tab has read Todo.
    items[0].fieldValues = conn([]);
    await ui.getByRole("combobox", { name: "Status", exact: true }).selectOption("done");
    await page.getByRole("dialog").getByRole("button", { name: "Use GitHub’s value" }).click();
    assert.equal(items[0].fieldValues.nodes.length, 0);
    await ui.getByRole("combobox", { name: "Status", exact: true }).selectOption("todo");
    await ui.getByText("Status saved", { exact: true }).waitFor();
    await ui.getByRole("searchbox").fill("-status:done");
    await ui.getByRole("combobox", { name: "Status", exact: true }).selectOption("done");
    await ui.getByRole("button", { name: "Undo", exact: true }).click();
    await ui.getByRole("button", { name: /Release task/ }).waitFor();
    await ui.getByRole("button", { name: "Add task", exact: false }).first().click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Task type").selectOption("issue");
    await dialog.getByLabel("Repository", { exact: true }).fill("octo/repo");
    await dialog.getByLabel("Title", { exact: true }).fill("Ship release");
    await dialog.getByRole("button", { name: "Add task", exact: true }).click();
    await dialog.getByRole("button", { name: "Retry unfinished step" }).waitFor();
    await page.reload();
    await ui.getByRole("button", { name: "Resume adding task" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Retry unfinished step" }).click();
    await ui.getByRole("button", { name: /Ship release/ }).waitFor();
    assert.equal(creates, 1);
    assert.equal(adds, 2);
    await ui.getByRole("button", { name: "Roadmap", exact: true }).click();
    await ui.getByRole("button", { name: "Unscheduled · Set dates" }).first().click();
    dialog = page.getByRole("dialog");
    const date = dialog.getByLabel("Target date");
    await date.fill("2026-11-18");
    await date.press("Enter");
    await dialog.getByRole("heading").first().click();
    await dialog.getByText("Target date saved", { exact: true }).waitFor();
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await page.reload();
    await ui.getByRole("button", { name: "Roadmap", exact: true }).waitFor();
    assert.equal(items[0].fieldValues.nodes.find((n) => n.field.id === "date").date, "2026-11-18");
    await ui.getByRole("button", { name: "Updates", exact: true }).click();
    await ui.getByLabel("Update", { exact: true }).fill("Iteration shipped");
    await ui.getByRole("button", { name: "Publish update" }).click();
    await ui.getByText("Iteration shipped", { exact: true }).last().waitFor();
    assert.equal(statusUpdates.length, 1);
    await page.goto(`${base}/projects/users/octo/3`);
    await ui.getByRole("button", { name: /Release task/ }).waitFor();
    assert.equal(await ui.getByRole("button", { name: "Add task" }).first().isDisabled(), true);
    assert.equal(
      await ui.getByRole("combobox", { name: "Status", exact: true }).first().inputValue(),
      "",
    );
    await ui.getByRole("button", { name: /Restricted item/ }).click();
    await page
      .getByRole("dialog")
      .getByText("Repository access required", { exact: true })
      .waitFor();
    await page.keyboard.press("Escape");
    await page.goto(`${base}/octo/repo/projects`);
    await page.getByRole("link", { name: /Release planning/ }).waitFor();
    assert.deepEqual(errors, []);
    console.log(
      "PASS project directory, repo entry, conversion, filter undo, scheduling, partial retry at",
      width,
    );
    await page.close();
  }
} finally {
  await browser.close();
}
