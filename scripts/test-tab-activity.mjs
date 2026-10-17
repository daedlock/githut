import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const app = process.env.UI_BASE_URL || "http://127.0.0.1:5196";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(app).hostname));
const server = process.env.UI_BASE_URL
  ? null
  : spawn(
      process.execPath,
      ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5196", "--strictPort"],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
let log = "";
server?.stdout.on("data", (chunk) => {
  log += chunk;
});
server?.stderr.on("data", (chunk) => {
  log += chunk;
});
process.once("exit", () => server?.kill());
for (let i = 0; ; i++) {
  try {
    if ((await fetch(app)).ok) break;
  } catch {}
  if (i === 100 || server?.exitCode != null) throw Error(log);
  await delay(200);
}
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const actor = {
  id: 1,
  login: "demo",
  avatar_url: "",
  html_url: "https://github.com/demo",
  type: "User",
  name: "Demo",
};
const repo = {
  id: 1,
  name: "project",
  full_name: "demo/project",
  owner: actor,
  default_branch: "main",
  private: false,
  fork: false,
  description: "Tab activity fixture",
  topics: [],
  language: "TypeScript",
  stargazers_count: 0,
  forks_count: 0,
  open_issues_count: 2,
  html_url: "https://github.com/demo/project",
  pushed_at: "2026-10-01T12:00:00Z",
  updated_at: "2026-10-01T12:00:00Z",
};
const created = "2026-10-01T12:00:00Z";
const pull = (number) => ({
  id: number,
  number,
  node_id: `P${number}`,
  url: `https://api.github.com/repos/demo/project/pulls/${number}`,
  html_url: `https://github.com/demo/project/pull/${number}`,
  state: "open",
  locked: false,
  title: `Pull ${number}`,
  body: "Loaded fixture description",
  draft: false,
  merged: false,
  merged_at: null,
  mergeable: true,
  mergeable_state: "clean",
  comments: 0,
  review_comments: 0,
  commits: 1,
  additions: 2,
  deletions: 0,
  changed_files: 1,
  created_at: created,
  updated_at: created,
  closed_at: null,
  user: actor,
  assignees: [],
  requested_reviewers: [],
  labels: [],
  head: { label: "demo:feature", ref: "feature", sha: "abc", repo },
  base: { label: "demo:main", ref: "main", sha: "def", repo },
});
const thread = (unread = true) => ({
  id: "thread-1",
  unread,
  reason: "mention",
  updated_at: created,
  last_read_at: null,
  subject: {
    title: "Pull 1",
    type: "PullRequest",
    url: "https://api.github.com/repos/demo/project/pulls/1",
    latest_comment_url: null,
  },
  repository: repo,
});
const saved = {
  version: 1,
  workspace: {
    layout: {
      kind: "island",
      id: "island",
      tabs: [
        { id: "inbox", href: "/" },
        { id: "pull", href: "/demo/project/pull/1" },
        { id: "alias", href: "/demo/project/pr/1/files" },
        { id: "issue", href: "/demo/project/issues/2" },
      ],
      selectedTabId: "inbox",
      pinned: [],
    },
    focusedIslandId: "island",
    focusHistory: ["island"],
    maximizedIslandId: null,
  },
};

async function fixture({ notifications = [], narrow = false, workspace = saved } = {}) {
  const context = await browser.newContext({
    viewport: { width: narrow ? 650 : 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  context.setDefaultTimeout(5000);
  await context.addInitScript(
    ({ workspace }) => {
      localStorage.setItem(
        "githut.auth",
        JSON.stringify({ state: { token: "activity-fixture" }, version: 0 }),
      );
      if (!sessionStorage.getItem("githut.workspace.window"))
        sessionStorage.setItem("githut.workspace.window", JSON.stringify(workspace));
    },
    { workspace },
  );
  const requests = [],
    details = [],
    writes = [],
    errors = [];
  let activity = Date.now() - 5000,
    ci = "PENDING",
    state = "OPEN",
    items = notifications;
  await context.route("https://api.github.com/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname;
    let data = [];
    if (path === "/graphql") {
      const body = request.postDataJSON();
      if (body.query.includes("query TabStatuses")) {
        requests.push(body.variables);
        data = { data: { viewer: { id: "fixture-account" } } };
        for (let index = 0; `number${index}` in body.variables; index++) {
          const number = body.variables[`number${index}`];
          data.data[`page${index}`] = {
            item: {
              title: `${number === 1 ? "Pull" : "Issue"} ${number}`,
              state,
              isDraft: false,
              updatedAt: new Date(activity).toISOString(),
              timelineItems: { updatedAt: new Date(activity).toISOString() },
              statusCheckRollup: { state: ci },
            },
          };
        }
      } else
        data = {
          data: {
            repository: {
              pullRequest: {
                reviewThreads: { nodes: [], pageInfo: { hasNextPage: false } },
                commits: {
                  nodes: [
                    { commit: { statusCheckRollup: { state: ci, contexts: { nodes: [] } } } },
                  ],
                },
              },
            },
          },
        };
    } else if (path.startsWith("/notifications/threads/")) {
      writes.push(request.method());
      items = items.map((item) => ({ ...item, unread: false }));
      return route.fulfill({ status: 205, body: "" });
    } else if (path === "/notifications") data = items;
    else if (path === "/user" || path === "/users/demo") data = actor;
    else if (path === "/user/repos" || path === "/user/starred") data = [repo];
    else if (path === "/repos/demo/project") data = repo;
    else if (path === "/search/issues")
      data = { total_count: 0, incomplete_results: false, items: [] };
    else if (/^\/repos\/demo\/project\/pulls\/\d+$/.test(path)) {
      details.push(path);
      data = pull(Number(path.split("/").at(-1)));
    } else if (/^\/repos\/demo\/project\/issues\/\d+$/.test(path)) {
      details.push(path);
      data = {
        ...pull(2),
        title: "Issue 2",
        reactions: {
          "+1": 0,
          "-1": 0,
          laugh: 0,
          hooray: 0,
          confused: 0,
          heart: 0,
          rocket: 0,
          eyes: 0,
          total_count: 0,
          url: "",
        },
      };
    }
    await route.fulfill({
      contentType: "application/json",
      headers: { "x-poll-interval": "60", "access-control-expose-headers": "x-poll-interval" },
      body: JSON.stringify(data),
    });
  });
  await context.route("**/api/**", (route) =>
    route.fulfill({ contentType: "application/json", body: "{}" }),
  );
  const page = await context.newPage();
  await page.clock.install({ time: new Date() });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(app);
  return {
    page,
    context,
    requests,
    details,
    writes,
    errors,
    update: (next) => {
      activity = next.activity ?? activity;
      ci = next.ci ?? ci;
      state = next.state ?? state;
      items = next.items ?? items;
    },
    close: () => context.close(),
  };
}

try {
  const f = await fixture();
  try {
    const tab = f.page.locator('[role="tab"][data-tab-id="pull"]');
    await tab.filter({ hasText: "Pull 1" }).waitFor({ timeout: 5000 });
    assert.equal(f.requests.length, 1, "one cheap batch owns all background metadata");
    assert.equal(f.details.length, 0, "restoring tabs must not eagerly fetch detailed pages");
    assert.deepEqual(
      Object.entries(f.requests[0])
        .filter(([key]) => key.startsWith("number"))
        .map(([, value]) => value),
      [1, 2],
      "aliases share a request",
    );
    assert.match(await tab.getAttribute("aria-label"), /CI running/);
    assert.equal(await tab.locator("[data-unread-dot]").count(), 0);
    f.update({ activity: Date.now() + 30_000, ci: "FAILURE" });
    await f.page.clock.fastForward(61_000);
    await tab.locator("[data-unread-dot]").waitFor({ timeout: 5000 });
    assert.match(await tab.getAttribute("aria-label"), /CI failed.*unread/i);
    assert.ok(
      await tab
        .locator('[data-tab-status="failed"]')
        .evaluate((element) => element.className.baseVal.includes("danger")),
      "CI failure uses semantic red",
    );
    assert.equal(f.details.length, 0);
    if (process.env.ACTIVITY_SCREENSHOT)
      await f.page.screenshot({ path: process.env.ACTIVITY_SCREENSHOT });
    await f.page.reload();
    await tab.locator("[data-unread-dot]").waitFor({ timeout: 5000 });
    await tab.click();
    await f.page
      .getByText("Loaded fixture description", { exact: true })
      .waitFor({ timeout: 5000 });
    await tab.locator("[data-unread-dot]").waitFor({ state: "detached", timeout: 5000 });
    assert.ok(f.details.some((path) => path.endsWith("/pulls/1")));
    assert.equal(
      await f.page.locator('[data-tab-id="alias"] [data-unread-dot]').count(),
      0,
      "viewing an alias acknowledges the shared page",
    );
    await f.page.locator('[role="tab"][data-tab-id="inbox"]').click();
    f.update({ state: "MERGED" });
    await f.page.clock.fastForward(61_000);
    await tab.locator('[data-tab-status="merged"]').waitFor();
    assert.doesNotMatch(
      await tab.getAttribute("aria-label"),
      /CI failed/,
      "merged state takes precedence over an old failed check",
    );
    assert.deepEqual(f.errors, []);
    console.log(
      "PASS background batching, red CI, persisted unread, and actual view acknowledgement",
    );
  } finally {
    await f.close();
  }

  const f2 = await fixture({ notifications: [thread(false)] });
  try {
    const page = f2.page,
      tab = page.locator('[role="tab"][data-tab-id="pull"]');
    await page.locator('[data-notification-row="thread-1"]').waitFor({ timeout: 5000 });
    await page.getByRole("button", { name: "Actions for Pull 1" }).click();
    await page.getByRole("menuitem", { name: "Mark unread (device only)" }).click();
    await tab.locator("[data-unread-dot]").waitFor({ timeout: 5000 });
    assert.equal(f2.writes.length, 0);
    await page.clock.fastForward(61_000);
    assert.equal(
      await tab.locator("[data-unread-dot]").count(),
      1,
      "a cache refresh cannot clear device-only unread",
    );
    await tab.click();
    await tab.locator("[data-unread-dot]").waitFor({ state: "detached", timeout: 5000 });
    assert.deepEqual(f2.writes, ["PATCH"]);
    assert.deepEqual(f2.errors, []);
    console.log("PASS Inbox device-only unread is shared with tab dots and clears on actual view");
  } finally {
    await f2.close();
  }

  const split = structuredClone(saved);
  split.workspace.layout = {
    kind: "split",
    id: "split",
    direction: "row",
    sizes: [0.5, 0.5],
    children: [
      {
        kind: "island",
        id: "island",
        tabs: [{ id: "inbox", href: "/" }],
        selectedTabId: "inbox",
        pinned: [],
      },
      {
        kind: "island",
        id: "second",
        tabs: [{ id: "pull", href: "/demo/project/pull/1" }],
        selectedTabId: "pull",
        pinned: [],
      },
    ],
  };
  const f3 = await fixture({ notifications: [thread()], narrow: true, workspace: split });
  try {
    const page = f3.page;
    await page.getByRole("button", { name: "Switch island or tab" }).click();
    const choice = page.locator('[data-switcher-tab="pull"]');
    await choice.locator("[data-unread-dot]").waitFor();
    await page.getByRole("menuitem", { name: /Pull 1, CI running, unread/ }).waitFor();
    assert.equal(f3.details.length, 0, "selected tabs in hidden islands stay background tabs");
    assert.equal(f3.writes.length, 0, "hidden island selection never marks its notification read");
    await page.keyboard.press("Escape");
    const beforeHidden = f3.requests.length;
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    f3.update({ ci: "FAILURE" });
    await page.clock.fastForward(300_000);
    assert.equal(f3.requests.length, beforeHidden, "a hidden browser window does not poll");
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "visible",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.getByRole("button", { name: "Switch island or tab" }).click();
    await page.getByRole("menuitem", { name: /Pull 1, CI failed, unread/ }).waitFor();
    assert.equal(
      f3.requests.length,
      beforeHidden + 1,
      "resuming uses one batch without catch-up bursts",
    );
    assert.equal(f3.writes.length, 0);
    await choice.click();
    await page.getByText("Loaded fixture description", { exact: true }).waitFor();
    await page
      .locator('[role="tab"][data-tab-id="pull"] [data-unread-dot]')
      .waitFor({ state: "detached" });
    assert.deepEqual(f3.writes, ["PATCH"]);
    assert.deepEqual(f3.errors, []);
    console.log("PASS narrow hidden-island state, hidden-window pause and focused-view read");
  } finally {
    await f3.close();
  }
} finally {
  await browser.close();
  server?.kill();
}
